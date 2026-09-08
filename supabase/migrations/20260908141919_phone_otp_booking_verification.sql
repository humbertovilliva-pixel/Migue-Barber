-- Add optional phone OTP verification to booking creation.
-- The feature remains disabled until an SMS provider is configured in Supabase Auth.

alter table public.booking_settings
  add column if not exists phone_verification_required boolean not null default false;

alter table public.bookings
  add column if not exists phone_verified_at timestamptz;

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
  v_day_config jsonb;
  v_open_time time without time zone;
  v_close_time time without time zone;
  v_start timestamp;
  v_service_end timestamp;
  v_busy_end timestamp;
  v_phone_key text;
  v_verified_phone_key text;
  v_phone_verified_at timestamptz;
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

  v_phone_key := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if length(v_phone_key) < 7 or length(v_phone_key) > 15 then
    raise exception 'Teléfono inválido' using errcode = 'P0001';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and active = true;

  if not found then
    raise exception 'Servicio no encontrado' using errcode = 'P0001';
  end if;

  select * into v_settings from public.booking_settings where id = 1;

  if v_settings.phone_verification_required then
    v_verified_phone_key := regexp_replace(coalesce(auth.jwt()->>'phone', ''), '[^0-9]', '', 'g');
    if v_verified_phone_key = '' or v_verified_phone_key <> v_phone_key then
      raise exception 'Verifica este número por SMS antes de confirmar la reserva' using errcode = 'P0001';
    end if;
    v_phone_verified_at := now();
  end if;

  v_day_config := v_settings.weekly_schedule -> (extract(dow from p_date)::integer)::text;
  if v_day_config is null
     or coalesce((v_day_config->>'enabled')::boolean, false) is not true then
    raise exception 'Ese día no está habilitado para reservas' using errcode = 'P0001';
  end if;

  begin
    v_open_time := (v_day_config->>'open_time')::time;
    v_close_time := (v_day_config->>'close_time')::time;
  exception when others then
    raise exception 'Configuración de horario inválida' using errcode = 'P0001';
  end;

  if v_close_time <= v_open_time then
    raise exception 'Configuración de horario inválida' using errcode = 'P0001';
  end if;

  v_start := p_date + p_time;
  v_service_end := v_start + make_interval(mins => v_service.duration_minutes);
  v_busy_end := v_start + make_interval(mins => v_service.duration_minutes + v_service.buffer_minutes);

  if v_start < (now() at time zone 'America/Monterrey') + make_interval(mins => v_settings.min_notice_minutes) then
    raise exception 'No hay suficiente anticipación para esa hora' using errcode = 'P0001';
  end if;

  if v_start < p_date + v_open_time
     or v_service_end > p_date + v_close_time then
    raise exception 'El servicio queda fuera del horario disponible' using errcode = 'P0001';
  end if;

  begin
    insert into public.bookings (
      service_id, service_name, service_duration, service_price,
      date, time, name, phone, phone_key, address, neighborhood, note,
      latitude, longitude, accepted_policies, status, scheduled_range, phone_verified_at
    ) values (
      v_service.id, v_service.name, v_service.duration_minutes, v_service.price,
      p_date, p_time, btrim(p_name), btrim(p_phone), v_phone_key, btrim(p_address), btrim(p_neighborhood), coalesce(btrim(p_note), ''),
      p_latitude, p_longitude, true, 'pending_confirmation', tsrange(v_start, v_busy_end, '[)'), v_phone_verified_at
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
      'phone_verified_at', v_booking.phone_verified_at,
      'status', v_booking.status,
      'created_at', v_booking.created_at
    ),
    'message', 'Tu horario ha sido registrado. Miguel podrá contactarte por WhatsApp para confirmar la ubicación, acceso y cualquier recargo de traslado aplicable.'
  );
end;
$$;

revoke all on function public.create_booking(uuid, date, time without time zone, text, text, text, text, text, double precision, double precision, boolean) from public;
grant execute on function public.create_booking(uuid, date, time without time zone, text, text, text, text, text, double precision, double precision, boolean) to anon, authenticated;
