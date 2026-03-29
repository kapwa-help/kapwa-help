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

-- Submissions: aid requests and feedback from the field
CREATE TABLE submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN ('request', 'feedback')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  contact_name    text NOT NULL,
  contact_phone   text,
  barangay_id     uuid NOT NULL REFERENCES barangays(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  notes           text,
  quantity_needed integer,
  urgency         text CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  rating          integer CHECK (rating BETWEEN 1 AND 5),
  issue_type      text CHECK (issue_type IN ('insufficient', 'damaged', 'wrong_items', 'delayed')),
  lat             decimal(9,6),
  lng             decimal(9,6),
  created_at      timestamptz DEFAULT now()
);

-- Seed aid categories
INSERT INTO aid_categories (name, icon) VALUES
  ('Water Filtration', 'droplet'),
  ('Meals', 'utensils'),
  ('Relief Goods', 'package'),
  ('Construction Materials', 'hammer'),
  ('Cleaning Supplies', 'sparkles'),
  ('Drinking Water', 'glass-water'),
  ('Kiddie Packs', 'baby');
