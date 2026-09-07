-- Tighten RPC grants and remove duplicate authenticated SELECT policies.

revoke execute on function public.is_current_user_admin() from anon;

create index if not exists bookings_service_id_idx on public.bookings (service_id);
create index if not exists admin_audit_user_id_idx on public.admin_audit (user_id);

-- Public content remains readable by anonymous visitors. Authenticated users use a
-- single policy that includes both normal public rows and admin access to hidden rows.
drop policy if exists services_public_read on public.services;
drop policy if exists services_admin_read on public.services;
create policy services_public_read on public.services for select to anon using (active = true);
create policy services_authenticated_read on public.services for select to authenticated using (active = true or private.is_admin());

drop policy if exists zones_public_read on public.zones;
drop policy if exists zones_admin_read on public.zones;
create policy zones_public_read on public.zones for select to anon using (active = true);
create policy zones_authenticated_read on public.zones for select to authenticated using (active = true or private.is_admin());

drop policy if exists faqs_public_read on public.faqs;
drop policy if exists faqs_admin_read on public.faqs;
create policy faqs_public_read on public.faqs for select to anon using (active = true);
create policy faqs_authenticated_read on public.faqs for select to authenticated using (active = true or private.is_admin());

drop policy if exists testimonials_public_read on public.testimonials;
drop policy if exists testimonials_admin_read on public.testimonials;
create policy testimonials_public_read on public.testimonials for select to anon using (active = true and permission_confirmed = true);
create policy testimonials_authenticated_read on public.testimonials for select to authenticated using ((active = true and permission_confirmed = true) or private.is_admin());

drop policy if exists policies_public_read on public.policies;
drop policy if exists policies_admin_read on public.policies;
create policy policies_public_read on public.policies for select to anon using (active = true);
create policy policies_authenticated_read on public.policies for select to authenticated using (active = true or private.is_admin());

drop policy if exists content_blocks_public_read on public.content_blocks;
drop policy if exists content_blocks_admin_read on public.content_blocks;
create policy content_blocks_public_read on public.content_blocks for select to anon using (active = true);
create policy content_blocks_authenticated_read on public.content_blocks for select to authenticated using (active = true or private.is_admin());

drop policy if exists media_public_read on public.media;
drop policy if exists media_admin_read on public.media;
create policy media_public_read on public.media for select to anon using (active = true);
create policy media_authenticated_read on public.media for select to authenticated using (active = true or private.is_admin());
