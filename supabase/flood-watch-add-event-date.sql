-- Add event_date column to flood_reports (run once on existing databases)
alter table flood_reports
  add column if not exists event_date date not null default current_date;

-- Drop and recreate the public view (CREATE OR REPLACE can't add columns mid-list)
drop view if exists flood_reports_public;

create view flood_reports_public
  with (security_invoker = false)
as
  select
    id,
    photo_url,
    latitude,
    longitude,
    event_date,
    weather_event,
    description,
    status,
    photo_taken_at,
    created_at
  from flood_reports
  where status = 'approved';

grant select on flood_reports_public to anon, authenticated;
