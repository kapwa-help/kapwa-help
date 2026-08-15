-- Flood Watch RLS policies

alter table flood_reports enable row level security;

-- Anyone can submit a report (forced pending, no review fields)
create policy "flood_reports_anon_insert"
  on flood_reports for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

-- Admins can read all reports (including pending + PII)
create policy "flood_reports_admin_select"
  on flood_reports for select
  to authenticated
  using (is_admin());

-- Admins can update status (approve/reject)
create policy "flood_reports_admin_update"
  on flood_reports for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Public view bypasses RLS via security_invoker=false
-- so anon can read approved, PII-stripped reports through the view

-- Storage: allow anonymous uploads and public reads for flood-reports/ prefix
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do nothing;

create policy "flood_photos_anon_upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = 'flood-reports');

create policy "flood_photos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = 'flood-reports');
