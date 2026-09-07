-- -----------------------------
-- Helpers
-- -----------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(coalesce(auth.jwt()->>'email', ''))
      and a.active = true
  );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;
revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_id text;
begin
  if auth.uid() is null or not private.is_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;
  v_id := coalesce(v_row->>'id', v_row->>'section_key', '');

  insert into public.admin_audit (user_id, user_email, action, entity_type, entity_id, summary)
  values (
    auth.uid(),
    auth.jwt()->>'email',
    lower(tg_op),
    tg_table_name,
    v_id,
    coalesce(v_row->>'name', v_row->>'neighborhood', v_row->>'question', v_row->>'display_name', '')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- -----------------------------
-- Booking RPCs
-- -----------------------------

create or replace function public.get_available_slots(p_service_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_cursor timestamp;
  v_last_start timestamp;
  v_candidate_end timestamp;
  v_now_local timestamp := now() at time zone 'America/Monterrey';
  v_slots jsonb := '[]'::jsonb;
begin
  select * into v_service
  from public.services
  where id = p_service_id and active = true;

  if not found then
    raise exception 'Servicio no encontrado' using errcode = 'P0001';
  end if;

  select * into v_settings from public.booking_settings where id = 1;

  if not (extract(dow from p_date)::integer = any(v_settings.open_days)) then
    return jsonb_build_object('date', to_char(p_date, 'YYYY-MM-DD'), 'slots', v_slots, 'reason', 'closed');
  end if;

  v_cursor := p_date::timestamp + make_interval(hours => v_settings.open_hour);
  v_last_start := p_date::timestamp + make_interval(hours => v_settings.close_hour)
                  - make_interval(mins => v_service.duration_minutes);

  while v_cursor <= v_last_start loop
    v_candidate_end := v_cursor + make_interval(mins => v_service.duration_minutes + v_service.buffer_minutes);

    if v_cursor >= v_now_local + make_interval(mins => v_settings.min_notice_minutes)
       and not exists (
         select 1
         from public.bookings b
         where b.status <> 'cancelled'
           and b.scheduled_range && tsrange(v_cursor, v_candidate_end, '[)')
       ) then
      v_slots := v_slots || to_jsonb(to_char(v_cursor, 'HH24:MI'));
    end if;

    v_cursor := v_cursor + make_interval(mins => v_settings.slot_step_minutes);
  end loop;

  return jsonb_build_object('date', to_char(p_date, 'YYYY-MM-DD'), 'slots', v_slots);
end;
$$;
revoke all on function public.get_available_slots(uuid, date) from public;
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;

create or replace function public.create_booking(
  p_service_id uuid,
  p_date date,
  p_time time without time zone,
  p_name text,
  p_phone text,
  p_address text,
  p_neighborhood text,
  p_note text default '',
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accepted_policies boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_start timestamp;
  v_service_end timestamp;
  v_busy_end timestamp;
  v_phone_key text;
  v_booking public.bookings%rowtype;
begin
  if coalesce(p_accepted_policies, false) is not true then
    raise exception 'Debes aceptar las políticas y el aviso de privacidad' using errcode = 'P0001';
  end if;

  if nullif(btrim(p_name), '') is null
     or nullif(btrim(p_phone), '') is null
     or nullif(btrim(p_address), '') is null
     or nullif(btrim(p_neighborhood), '') is null then
    raise exception 'Completa todos los campos requeridos' using errcode = 'P0001';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and active = true;
  if not found then
    raise exception 'Servicio no encontrado' using errcode = 'P0001';
  end if;

  select * into v_settings from public.booking_settings where id = 1;

  if not (extract(dow from p_date)::integer = any(v_settings.open_days)) then
    raise exception 'Ese día no está habilitado para reservas' using errcode = 'P0001';
  end if;

  v_start := p_date + p_time;
  v_service_end := v_start + make_interval(mins => v_service.duration_minutes);
  v_busy_end := v_start + make_interval(mins => v_service.duration_minutes + v_service.buffer_minutes);

  if v_start < (now() at time zone 'America/Monterrey') + make_interval(mins => v_settings.min_notice_minutes) then
    raise exception 'No hay suficiente anticipación para esa hora' using errcode = 'P0001';
  end if;

  if v_start < p_date::timestamp + make_interval(hours => v_settings.open_hour)
     or v_service_end > p_date::timestamp + make_interval(hours => v_settings.close_hour) then
    raise exception 'El servicio queda fuera del horario disponible' using errcode = 'P0001';
  end if;

  v_phone_key := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if length(v_phone_key) < 7 then
    raise exception 'Teléfono inválido' using errcode = 'P0001';
  end if;

  begin
    insert into public.bookings (
      service_id, service_name, service_duration, service_price,
      date, time, name, phone, phone_key, address, neighborhood, note,
      latitude, longitude, accepted_policies, status, scheduled_range
    ) values (
      v_service.id, v_service.name, v_service.duration_minutes, v_service.price,
      p_date, p_time, btrim(p_name), btrim(p_phone), v_phone_key, btrim(p_address), btrim(p_neighborhood), coalesce(btrim(p_note), ''),
      p_latitude, p_longitude, true, 'pending_confirmation', tsrange(v_start, v_busy_end, '[)')
    ) returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'Ese horario ya no está disponible' using errcode = 'P0001';
  end;

  insert into public.clients (
    phone_key, phone, name, first_seen_at, last_seen_at, bookings_count,
    last_address, last_neighborhood, last_latitude, last_longitude
  ) values (
    v_phone_key, btrim(p_phone), btrim(p_name), now(), now(), 1,
    btrim(p_address), btrim(p_neighborhood), p_latitude, p_longitude
  )
  on conflict (phone_key) do update set
    phone = excluded.phone,
    name = excluded.name,
    last_seen_at = now(),
    bookings_count = public.clients.bookings_count + 1,
    last_address = excluded.last_address,
    last_neighborhood = excluded.last_neighborhood,
    last_latitude = excluded.last_latitude,
    last_longitude = excluded.last_longitude;

  return jsonb_build_object(
    'ok', true,
    'booking', jsonb_build_object(
      'id', v_booking.id,
      'service_id', v_booking.service_id,
      'service_name', v_booking.service_name,
      'service_duration', v_booking.service_duration,
      'service_price', v_booking.service_price,
      'date', to_char(v_booking.date, 'YYYY-MM-DD'),
      'time', substring(v_booking.time::text from 1 for 5),
      'name', v_booking.name,
      'phone', v_booking.phone,
      'address', v_booking.address,
      'neighborhood', v_booking.neighborhood,
      'note', v_booking.note,
      'latitude', v_booking.latitude,
      'longitude', v_booking.longitude,
      'accepted_policies', v_booking.accepted_policies,
      'status', v_booking.status,
      'created_at', v_booking.created_at
    ),
    'message', 'Tu horario ha sido registrado. Miguel podrá contactarte por WhatsApp para confirmar la ubicación, acceso y cualquier recargo de traslado aplicable.'
  );
end;
$$;
revoke all on function public.create_booking(uuid, date, time without time zone, text, text, text, text, text, double precision, double precision, boolean) from public;
grant execute on function public.create_booking(uuid, date, time without time zone, text, text, text, text, text, double precision, double precision, boolean) to anon, authenticated;

-- -----------------------------
-- Updated-at and audit triggers
-- -----------------------------

do $$
declare
  t text;
begin
  foreach t in array array['services','zones','faqs','testimonials','policies','site_settings','booking_settings','content_blocks','media','bookings']
  loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t, t);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['services','zones','faqs','testimonials','policies','site_settings','booking_settings','content_blocks','media','clients','bookings']
  loop
    execute format('create trigger %I_admin_audit after insert or update or delete on public.%I for each row execute function private.audit_admin_change()', t, t);
  end loop;
end $$;

