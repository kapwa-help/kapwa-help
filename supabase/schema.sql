-- LUaid.org — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables.

-- Events: disaster operations that scope all data
CREATE TABLE events (
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
CREATE TABLE organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  type         text NOT NULL CHECK (type IN ('donor', 'hub', 'both')),
  municipality text,
  lat          decimal(9,6),
  lng          decimal(9,6),
  created_at   timestamptz DEFAULT now()
);

-- Aid categories: broad groupings for dashboard rollups
CREATE TABLE aid_categories (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text
);

-- Barangays: geographic aggregation layer
CREATE TABLE barangays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  municipality text NOT NULL,
  lat          decimal(9,6),
  lng          decimal(9,6),
  population   integer,
  created_at   timestamptz DEFAULT now()
);

-- Donations: monetary contributions
CREATE TABLE donations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  amount          decimal(12,2) NOT NULL,
  date            date NOT NULL,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- Deployments: every aid delivery event (core table)
CREATE TABLE deployments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  barangay_id     uuid REFERENCES barangays(id),
  quantity        integer,
  unit            text,
  recipient       text,
  lat             decimal(9,6),
  lng             decimal(9,6),
  date            date,
  volunteer_count integer,
  hours           decimal(5,1),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- Submissions: aid needs and feedback from the field
-- "Needs" follow the KapwaRelief pin lifecycle (docs/scope §5.B)
CREATE TABLE submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  type            text NOT NULL CHECK (type IN ('need', 'request', 'feedback')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'in_transit', 'completed', 'resolved')),
  -- Contact
  contact_name    text NOT NULL,
  contact_phone   text,
  -- Location
  barangay_id     uuid NOT NULL REFERENCES barangays(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  gap_category    text CHECK (gap_category IN ('lunas', 'sustenance', 'shelter')),
  lat             decimal(9,6),
  lng             decimal(9,6),
  -- Access / passability (scope §5.A)
  access_status   text CHECK (access_status IN ('truck', '4x4', 'boat', 'foot_only', 'cut_off')),
  -- Need details
  quantity_needed integer,
  urgency         text CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  notes           text,
  photo_url       text,
  -- Feedback fields (type='feedback' only)
  rating          integer CHECK (rating BETWEEN 1 AND 5),
  issue_type      text CHECK (issue_type IN ('insufficient', 'damaged', 'wrong_items', 'delayed')),
  -- Timestamps
  verified_at     timestamptz,
  completed_at    timestamptz,
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
  ('Kiddie Packs', 'baby');

-- Scope-aligned gap categories (KapwaRelief "The Gap" taxonomy)
INSERT INTO aid_categories (name, icon) VALUES
  ('Lunas', 'heart-pulse'),
  ('Sustenance', 'utensils'),
  ('Shelter', 'house');
