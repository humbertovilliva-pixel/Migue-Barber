-- -----------------------------
-- RLS + grants
-- -----------------------------

alter table public.admin_allowlist enable row level security;
alter table public.services enable row level security;
alter table public.zones enable row level security;
alter table public.faqs enable row level security;
alter table public.testimonials enable row level security;
alter table public.policies enable row level security;
alter table public.site_settings enable row level security;
alter table public.booking_settings enable row level security;
alter table public.content_blocks enable row level security;
alter table public.media enable row level security;
alter table public.clients enable row level security;
alter table public.bookings enable row level security;
alter table public.admin_audit enable row level security;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.services, public.zones, public.faqs, public.testimonials,
  public.policies, public.site_settings, public.booking_settings, public.content_blocks, public.media
  to anon, authenticated;

grant select, insert, update, delete on public.services, public.zones, public.faqs,
  public.testimonials, public.policies, public.site_settings, public.booking_settings,
  public.content_blocks, public.media, public.clients, public.bookings
  to authenticated;
grant select on public.admin_audit to authenticated;

create policy services_public_read on public.services for select to anon, authenticated using (active = true);
create policy services_admin_read on public.services for select to authenticated using (private.is_admin());
create policy services_admin_insert on public.services for insert to authenticated with check (private.is_admin());
create policy services_admin_update on public.services for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy services_admin_delete on public.services for delete to authenticated using (private.is_admin());

create policy zones_public_read on public.zones for select to anon, authenticated using (active = true);
create policy zones_admin_read on public.zones for select to authenticated using (private.is_admin());
create policy zones_admin_insert on public.zones for insert to authenticated with check (private.is_admin());
create policy zones_admin_update on public.zones for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy zones_admin_delete on public.zones for delete to authenticated using (private.is_admin());

create policy faqs_public_read on public.faqs for select to anon, authenticated using (active = true);
create policy faqs_admin_read on public.faqs for select to authenticated using (private.is_admin());
create policy faqs_admin_insert on public.faqs for insert to authenticated with check (private.is_admin());
create policy faqs_admin_update on public.faqs for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy faqs_admin_delete on public.faqs for delete to authenticated using (private.is_admin());

create policy testimonials_public_read on public.testimonials for select to anon, authenticated using (active = true and permission_confirmed = true);
create policy testimonials_admin_read on public.testimonials for select to authenticated using (private.is_admin());
create policy testimonials_admin_insert on public.testimonials for insert to authenticated with check (private.is_admin());
create policy testimonials_admin_update on public.testimonials for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy testimonials_admin_delete on public.testimonials for delete to authenticated using (private.is_admin());

create policy policies_public_read on public.policies for select to anon, authenticated using (active = true);
create policy policies_admin_read on public.policies for select to authenticated using (private.is_admin());
create policy policies_admin_insert on public.policies for insert to authenticated with check (private.is_admin());
create policy policies_admin_update on public.policies for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy policies_admin_delete on public.policies for delete to authenticated using (private.is_admin());

create policy site_settings_public_read on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_admin_update on public.site_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy booking_settings_public_read on public.booking_settings for select to anon, authenticated using (true);
create policy booking_settings_admin_update on public.booking_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy content_blocks_public_read on public.content_blocks for select to anon, authenticated using (active = true);
create policy content_blocks_admin_read on public.content_blocks for select to authenticated using (private.is_admin());
create policy content_blocks_admin_insert on public.content_blocks for insert to authenticated with check (private.is_admin());
create policy content_blocks_admin_update on public.content_blocks for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy content_blocks_admin_delete on public.content_blocks for delete to authenticated using (private.is_admin());

create policy media_public_read on public.media for select to anon, authenticated using (active = true);
create policy media_admin_read on public.media for select to authenticated using (private.is_admin());
create policy media_admin_insert on public.media for insert to authenticated with check (private.is_admin());
create policy media_admin_update on public.media for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy media_admin_delete on public.media for delete to authenticated using (private.is_admin());

create policy clients_admin_read on public.clients for select to authenticated using (private.is_admin());
create policy clients_admin_insert on public.clients for insert to authenticated with check (private.is_admin());
create policy clients_admin_update on public.clients for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy clients_admin_delete on public.clients for delete to authenticated using (private.is_admin());

create policy bookings_admin_read on public.bookings for select to authenticated using (private.is_admin());
create policy bookings_admin_update on public.bookings for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy bookings_admin_delete on public.bookings for delete to authenticated using (private.is_admin());

create policy admin_audit_admin_read on public.admin_audit for select to authenticated using (private.is_admin());

-- -----------------------------
-- Storage
-- -----------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'barber-media',
  'barber-media',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy barber_media_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'barber-media' and private.is_admin());

create policy barber_media_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'barber-media' and private.is_admin())
with check (bucket_id = 'barber-media' and private.is_admin());

create policy barber_media_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'barber-media' and private.is_admin());

