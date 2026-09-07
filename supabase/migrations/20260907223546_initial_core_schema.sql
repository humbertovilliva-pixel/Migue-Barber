-- Miguel Suárez Barber — initial Supabase schema
-- Replaces the original MongoDB/FastAPI persistence with Postgres + Auth + Storage.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------
-- Core tables
-- -----------------------------

create table public.admin_allowlist (
  email text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint admin_allowlist_email_lowercase check (email = lower(email))
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text not null default '',
  full_description text not null default '',
  price integer not null check (price >= 0),
  currency text not null default 'MXN',
  duration_minutes integer not null check (duration_minutes > 0),
  buffer_minutes integer not null default 20 check (buffer_minutes >= 0),
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  neighborhood text not null,
  featured boolean not null default false,
  surcharge_amount integer check (surcharge_amount is null or surcharge_amount >= 0),
  surcharge_status text not null default 'confirm_by_whatsapp'
    check (surcharge_status in ('confirm_by_whatsapp', 'included', 'fixed')),
  message text not null default '',
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null default 'general',
  pending_confirmation boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  service_name text not null default '',
  content text not null,
  permission_confirmed boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null default 'Miguel Suárez',
  full_name text not null default 'Miguel Ángel Suárez',
  descriptor text not null default 'Barbero profesional a domicilio',
  slogan text not null default 'Precisión y estilo, donde tú estés.',
  phone text not null default '+52 871 463 3372',
  whatsapp text not null default '528714633372',
  email text not null default 'Suarezmaiky25@gmail.com',
  city text not null default 'Torreón, Coahuila',
  instagram text not null default '',
  facebook text not null default '',
  booking_url text not null default '',
  hero_image_url text not null default '',
  about_image_url text not null default '',
  updated_at timestamptz not null default now()
);

create table public.booking_settings (
  id smallint primary key default 1 check (id = 1),
  open_days integer[] not null default array[0],
  open_hour integer not null default 11 check (open_hour between 0 and 23),
  close_hour integer not null default 18 check (close_hour between 1 and 24),
  min_notice_minutes integer not null default 60 check (min_notice_minutes >= 0),
  slot_step_minutes integer not null default 15 check (slot_step_minutes > 0),
  updated_at timestamptz not null default now(),
  constraint booking_settings_hours_valid check (close_hour > open_hour),
  constraint booking_settings_days_valid check (open_days <@ array[0,1,2,3,4,5,6])
);

create table public.content_blocks (
  section_key text primary key,
  eyebrow text not null default '',
  title text not null default '',
  content text not null default '',
  cta_label text not null default '',
  cta_url text not null default '',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  file_url text not null,
  content_type text not null,
  size bigint not null check (size >= 0 and size <= 8388608),
  category text not null default 'gallery',
  alt_text text not null default '',
  active boolean not null default true,
  display_order integer not null default 0,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  phone_key text not null unique,
  phone text not null,
  name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  bookings_count integer not null default 1 check (bookings_count >= 0),
  last_address text not null default '',
  last_neighborhood text not null default '',
  last_latitude double precision,
  last_longitude double precision,
  notes text not null default '',
  tags text[] not null default '{}'
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on update restrict on delete restrict,
  service_name text not null,
  service_duration integer not null check (service_duration > 0),
  service_price integer not null check (service_price >= 0),
  date date not null,
  time time without time zone not null,
  name text not null,
  phone text not null,
  phone_key text not null,
  address text not null,
  neighborhood text not null,
  note text not null default '',
  latitude double precision,
  longitude double precision,
  accepted_policies boolean not null,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'confirmed', 'completed', 'cancelled', 'no_show')),
  scheduled_range tsrange not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create extension if not exists btree_gist with schema extensions;
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (scheduled_range with &&)
  where (status <> 'cancelled');

create index bookings_date_idx on public.bookings (date, time);
create index bookings_phone_key_idx on public.bookings (phone_key);
create index clients_last_seen_idx on public.clients (last_seen_at desc);
create index media_category_order_idx on public.media (category, display_order, created_at desc);

create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null default '',
  created_at timestamptz not null default now()
);

