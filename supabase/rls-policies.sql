-- RLS Policies: V1 Data Model
-- Open read access for dashboard. Write policies for demo phase.

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_events" ON events
  FOR SELECT USING (true);

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_organizations" ON organizations
  FOR SELECT USING (true);

-- Deployment Hubs
ALTER TABLE deployment_hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_deployment_hubs" ON deployment_hubs
  FOR SELECT USING (true);

-- Aid categories
ALTER TABLE aid_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_aid_categories" ON aid_categories
  FOR SELECT USING (true);

-- Hub Inventory
ALTER TABLE hub_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_hub_inventory" ON hub_inventory
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_hub_inventory" ON hub_inventory
  FOR INSERT WITH CHECK (true);

-- Needs
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_needs" ON needs
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_needs" ON needs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_needs" ON needs
  FOR UPDATE USING (true) WITH CHECK (true);

-- Need Categories
ALTER TABLE need_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_need_categories" ON need_categories
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_need_categories" ON need_categories
  FOR INSERT WITH CHECK (true);

-- Donations
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_donations" ON donations
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_donations" ON donations
  FOR INSERT WITH CHECK (true);

-- Donation Categories
ALTER TABLE donation_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_donation_categories" ON donation_categories
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_donation_categories" ON donation_categories
  FOR INSERT WITH CHECK (true);

-- Purchases
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_purchases" ON purchases
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_purchases" ON purchases
  FOR INSERT WITH CHECK (true);

-- Purchase Categories
ALTER TABLE purchase_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_purchase_categories" ON purchase_categories
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_purchase_categories" ON purchase_categories
  FOR INSERT WITH CHECK (true);

-- Hazards
ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_hazards" ON hazards
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_hazards" ON hazards
  FOR INSERT WITH CHECK (true);

-- Deployments
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_deployments" ON deployments
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_deployments" ON deployments
  FOR INSERT WITH CHECK (true);
