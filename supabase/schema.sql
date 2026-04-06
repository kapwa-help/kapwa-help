-- LUaid.org — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables.
-- Safe to run multiple times: uses IF NOT EXISTS throughout.

-- Events: disaster operations that scope all data
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

-- Organizations: donors, deployment hubs, or both
CREATE TABLE IF NOT EXISTS organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  municipality text,
  lat          decimal(9,6),
  lng          decimal(9,6),
  created_at   timestamptz DEFAULT now()
);

-- Aid categories: broad groupings for dashboard rollups
CREATE TABLE IF NOT EXISTS aid_categories (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text
);

-- Barangays: geographic aggregation layer
CREATE TABLE IF NOT EXISTS barangays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  municipality text NOT NULL,
  lat          decimal(9,6),
  lng          decimal(9,6),
  population   integer,
  created_at   timestamptz DEFAULT now()
);

-- Donations: monetary or in-kind contributions
CREATE TABLE IF NOT EXISTS donations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type            text NOT NULL DEFAULT 'cash' CHECK (type IN ('cash', 'in_kind')),
  -- Cash donations
  amount          decimal(12,2),
  -- In-kind donations
  aid_category_id uuid REFERENCES aid_categories(id),
  quantity        integer,
  unit            text,
  -- Common fields
  date            date NOT NULL,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- Purchases: goods bought with donation money
CREATE TABLE IF NOT EXISTS purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  quantity        integer NOT NULL,
  unit            text,
  cost            decimal(12,2),
  date            date DEFAULT CURRENT_DATE,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- Submissions: needs from the field
-- "Needs" follow the KapwaRelief pin lifecycle (docs/scope §5.B)
CREATE TABLE IF NOT EXISTS submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'in_transit', 'completed', 'resolved')),
  -- Contact
  contact_name    text NOT NULL,
  contact_phone   text,
  -- Location
  barangay_id     uuid NOT NULL REFERENCES barangays(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  lat             decimal(9,6),
  lng             decimal(9,6),
  geohash         text,
  -- Access / passability (scope §5.A)
  access_status   text NOT NULL CHECK (access_status IN ('truck', '4x4', 'boat', 'foot_only', 'cut_off')),
  -- Need details
  quantity_needed integer,
  urgency         text NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  num_adults      integer DEFAULT 0,
  num_children    integer DEFAULT 0,
  num_seniors_pwd integer DEFAULT 0,
  notes           text,
  submission_photo_url text,
  dispatch_photo_url   text,
  delivery_photo_url   text,
  -- Timestamps
  verified_at     timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Deployments (Relief Actions): every aid delivery event
-- Can optionally fulfill a specific need (submission_id)
CREATE TABLE IF NOT EXISTS deployments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  barangay_id     uuid REFERENCES barangays(id),
  submission_id   uuid UNIQUE REFERENCES submissions(id),
  quantity        integer,
  unit            text,
  date            date,
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'received')),
  created_at      timestamptz DEFAULT now()
);

-- Hazards: field-reported hazard conditions
CREATE TABLE IF NOT EXISTS hazards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id),
  hazard_type text NOT NULL CHECK (hazard_type IN (
                'flood', 'landslide', 'road_blocked',
                'bridge_out', 'electrical_hazard', 'other'
              )),
  description text,
  photo_url   text,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  reported_by text,
  created_at  timestamptz DEFAULT now()
);

-- Seed aid categories (Hannah's unified 9-category list)
INSERT INTO aid_categories (name, icon) VALUES
  ('Hot Meals', '🍲'),
  ('Drinking Water', '💧'),
  ('Water Filtration', '🚰'),
  ('Temporary Shelter', '🏕️'),
  ('Clothing', '👕'),
  ('Construction Materials', '🔨'),
  ('Medical Supplies', '🏥'),
  ('Hygiene Kits', '🧼'),
  ('Canned Food', '🥫')
ON CONFLICT (name) DO NOTHING;
