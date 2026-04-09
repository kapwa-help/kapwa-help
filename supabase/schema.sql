-- ============================================================
-- Kapwa Help — V1 Data Model
-- ============================================================

-- Enums
CREATE TYPE access_status AS ENUM ('truck', '4x4', 'boat', 'foot_only', 'cut_off');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE need_status AS ENUM ('pending', 'verified', 'in_transit', 'confirmed');
CREATE TYPE donation_type AS ENUM ('cash', 'in_kind');
CREATE TYPE donor_type AS ENUM ('individual', 'organization');
CREATE TYPE hazard_status AS ENUM ('active', 'resolved');

-- Events (scopes everything)
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  region text,
  started_at date,
  ended_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Organizations (financial/accountability layer)
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  name text NOT NULL,
  description text,
  contact_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deployment Hubs (operational/map layer — independent from orgs)
CREATE TABLE deployment_hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  name text NOT NULL,
  lat decimal(9,6) NOT NULL,
  lng decimal(9,6) NOT NULL,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Aid Categories (shared vocabulary)
CREATE TABLE aid_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text NOT NULL
);

-- Hub Inventory (junction — which categories a hub currently has)
CREATE TABLE hub_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES deployment_hubs(id) ON DELETE CASCADE,
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  UNIQUE(hub_id, aid_category_id)
);

-- Needs (demand side — community or hub needs)
CREATE TABLE needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  hub_id uuid REFERENCES deployment_hubs(id),
  lat decimal(9,6) NOT NULL,
  lng decimal(9,6) NOT NULL,
  access_status access_status NOT NULL,
  urgency urgency_level NOT NULL,
  status need_status NOT NULL DEFAULT 'pending',
  num_people integer NOT NULL,
  contact_name text NOT NULL,
  contact_phone text,
  notes text,
  delivery_photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Need Categories (junction — multi-select aid types per need)
CREATE TABLE need_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  UNIQUE(need_id, aid_category_id)
);

-- Donations (financial ledger)
CREATE TABLE donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  donor_name text,
  donor_type donor_type,
  type donation_type NOT NULL,
  amount decimal(12,2),
  date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((type = 'cash' AND amount IS NOT NULL) OR type = 'in_kind')
);

-- Donation Categories (junction — multi-select for in-kind)
CREATE TABLE donation_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  UNIQUE(donation_id, aid_category_id)
);

-- Purchases (org spending record)
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  cost decimal(12,2) NOT NULL,
  date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Purchase Categories (junction — multi-select)
CREATE TABLE purchase_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  UNIQUE(purchase_id, aid_category_id)
);

-- Hazards (map layer)
CREATE TABLE hazards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  description text NOT NULL,
  photo_url text,
  latitude decimal(9,6) NOT NULL,
  longitude decimal(9,6) NOT NULL,
  status hazard_status NOT NULL DEFAULT 'active',
  reported_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deployments (fulfillment record — created when need is confirmed)
CREATE TABLE deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  hub_id uuid NOT NULL REFERENCES deployment_hubs(id),
  need_id uuid NOT NULL UNIQUE REFERENCES needs(id),
  date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed aid categories
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
