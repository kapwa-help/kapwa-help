-- migrate-to-needs.sql — Idempotent migration for needs coordination feature
-- Bridges the original 5-table schema to the full needs coordination schema.
-- Safe to run multiple times: uses IF NOT EXISTS / IF EXISTS throughout.
--
-- Run in the Supabase SQL Editor BEFORE seeding with seed-demo.sql.
--
-- What this migration adds:
--   1. events table (disaster operations that scope all data)
--   2. submissions: new columns (event_id, gap_category, access_status, etc.)
--   3. submissions: updated CHECK constraints (type, status enums)
--   4. deployments: new columns (event_id, submission_id)
--   5. Gap-category aid_categories seed rows
--   6. RLS policies for events table

BEGIN;

-- ============================================================
-- 1. Create events table
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  region      text NOT NULL,
  started_at  date NOT NULL,
  ended_at    date,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Add new columns to submissions
--    Each uses IF NOT EXISTS so re-runs are safe.
-- ============================================================
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS event_id        uuid REFERENCES events(id);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS gap_category    text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS access_status   text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lat             decimal(9,6);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lng             decimal(9,6);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS quantity_needed integer;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS urgency         text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS photo_url       text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS verified_at     timestamptz;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS completed_at    timestamptz;

-- ============================================================
-- 3. Update CHECK constraints on submissions
--    DROP IF EXISTS + re-add ensures correct enum values.
-- ============================================================

-- type: was ('request', 'feedback') → now includes 'need'
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_type_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_type_check
  CHECK (type IN ('need', 'request', 'feedback'));

-- status: was ('pending', 'resolved') → now full lifecycle
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('pending', 'verified', 'in_transit', 'completed', 'resolved'));

-- New constraints for new columns
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_gap_category_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_gap_category_check
  CHECK (gap_category IN ('lunas', 'sustenance', 'shelter'));

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_access_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_access_status_check
  CHECK (access_status IN ('truck', '4x4', 'boat', 'foot_only', 'cut_off'));

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_urgency_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_urgency_check
  CHECK (urgency IN ('low', 'medium', 'high', 'critical'));

-- ============================================================
-- 4. Add new columns to deployments
-- ============================================================
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS event_id      uuid REFERENCES events(id);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS submission_id  uuid REFERENCES submissions(id);

-- ============================================================
-- 5. Seed gap-category aid categories
-- ============================================================
INSERT INTO aid_categories (name, icon) VALUES
  ('Lunas', 'heart-pulse'),
  ('Sustenance', 'utensils'),
  ('Shelter', 'house')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 6. RLS policies for events table
--    Uses IF NOT EXISTS pattern (check pg_policies before creating).
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'anon_read_events'
  ) THEN
    CREATE POLICY "anon_read_events" ON events FOR SELECT USING (true);
  END IF;
END $$;

COMMIT;
