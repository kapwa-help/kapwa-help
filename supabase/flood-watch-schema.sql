-- Flood Watch schema (isolated from event-scoped tables)

create type flood_report_status as enum ('pending', 'approved', 'rejected');

create table flood_reports (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  latitude float8 not null,
  longitude float8 not null,
  weather_event text,
  description text,
  reporter_name text,
  reporter_phone text,
  status flood_report_status not null default 'pending',
  photo_taken_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

-- Public view: approved reports only, PII stripped
create or replace view flood_reports_public
  with (security_invoker = false)
as
  select
    id,
    photo_url,
    latitude,
    longitude,
    weather_event,
    description,
    status,
    photo_taken_at,
    created_at
  from flood_reports
  where status = 'approved';
