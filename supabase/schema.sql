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

-- === Admin Users ===
-- Presence in this table = admin. Rows are only created by the invite flow
-- (via the handle_new_user trigger below reading role='admin' metadata).

CREATE TABLE admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  invited_by uuid REFERENCES admin_users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to auto-provision an admin_users row when invite metadata is set.
-- SECURITY: gate on new.invited_at IS NOT NULL — only users created via
-- auth.admin.inviteUserByEmail (service role) have this set. This prevents
-- a self-signup from claiming admin by passing role='admin' in user metadata
-- even if signup is accidentally enabled in the Supabase dashboard.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF new.invited_at IS NOT NULL
     AND COALESCE(new.raw_user_meta_data ->> 'role', '') = 'admin' THEN
    INSERT INTO public.admin_users (user_id, email, invited_by, display_name)
    VALUES (
      new.id,
      new.email,
      NULLIF(new.raw_user_meta_data ->> 'invited_by', '')::uuid,
      new.raw_user_meta_data ->> 'display_name'
    );
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

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
  created_by uuid REFERENCES auth.users(id),
  verified_by uuid REFERENCES auth.users(id),
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
  created_by uuid REFERENCES auth.users(id),
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
  created_by uuid REFERENCES auth.users(id),
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
  contact_phone text,
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
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- === Public Views (PII-stripped) ===
-- security_invoker=false is set EXPLICITLY (not relying on Postgres defaults):
-- these views run with the view owner's permissions, deliberately bypassing
-- base-table RLS so anon readers can see the non-PII subset. The base tables'
-- RLS (rls-prod.sql) denies anon SELECT; the view is the only anon read path.

CREATE VIEW needs_public WITH (security_invoker=false) AS
  SELECT id, event_id, hub_id, lat, lng, access_status, urgency,
         status, num_people, notes, delivery_photo_url, created_at
    FROM needs;

CREATE VIEW hazards_public WITH (security_invoker=false) AS
  SELECT id, event_id, description, photo_url, latitude, longitude,
         status, created_at
    FROM hazards;

GRANT SELECT ON needs_public TO anon, authenticated;
GRANT SELECT ON hazards_public TO anon, authenticated;

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
