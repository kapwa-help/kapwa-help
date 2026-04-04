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
  type         text NOT NULL CHECK (type IN ('donor', 'hub', 'both')),
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

-- Donations: monetary contributions
CREATE TABLE IF NOT EXISTS donations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  amount          decimal(12,2) NOT NULL,
  date            date NOT NULL,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- Submissions: needs from the field
-- "Needs" follow the KapwaRelief pin lifecycle (docs/scope §5.B)
CREATE TABLE IF NOT EXISTS submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  type            text NOT NULL CHECK (type IN ('need')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'in_transit', 'completed', 'resolved')),
  -- Contact
  contact_name    text NOT NULL,
  contact_phone   text,
  -- Location
  barangay_id     uuid NOT NULL REFERENCES barangays(id),
  gap_category    text NOT NULL CHECK (gap_category IN ('lunas', 'sustenance', 'shelter')),
  lat             decimal(9,6),
  lng             decimal(9,6),
  -- Access / passability (scope §5.A)
  access_status   text NOT NULL CHECK (access_status IN ('truck', '4x4', 'boat', 'foot_only', 'cut_off')),
  -- Need details
  quantity_needed integer,
  urgency         text NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
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
  recipient       text,
  lat             decimal(9,6),
  lng             decimal(9,6),
  date            date,
  volunteer_count integer,
  hours           decimal(5,1),
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'received')),
  created_at      timestamptz DEFAULT now()
);

-- Seed aid categories
-- Original dashboard categories
INSERT INTO aid_categories (name, icon) VALUES
  ('Water Filtration', 'droplet'),
  ('Meals', 'utensils'),
  ('Relief Goods', 'package'),
  ('Construction Materials', 'hammer'),
  ('Cleaning Supplies', 'sparkles'),
  ('Drinking Water', 'glass-water'),
  ('Kiddie Packs', 'baby')
ON CONFLICT (name) DO NOTHING;

-- Scope-aligned gap categories (KapwaRelief "The Gap" taxonomy)
INSERT INTO aid_categories (name, icon) VALUES
  ('Lunas', 'heart-pulse'),
  ('Sustenance', 'utensils'),
  ('Shelter', 'house')
ON CONFLICT (name) DO NOTHING;
