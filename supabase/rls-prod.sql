-- RLS Policies: Production (auth-gated)
-- Apply to kapwa-help-prod ONLY. Demo uses rls-demo.sql.

-- === Helper ===
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$;

-- === Events: public read, admin write ===
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_read on events FOR SELECT USING (true);
CREATE POLICY events_admin_write on events FOR INSERT WITH CHECK (is_admin());
CREATE POLICY events_admin_update on events FOR UPDATE USING (is_admin());
CREATE POLICY events_admin_delete on events FOR DELETE USING (is_admin());

-- === Organizations: public read, admin write ===
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY orgs_read on organizations FOR SELECT USING (true);
CREATE POLICY orgs_admin_write on organizations FOR INSERT WITH CHECK (is_admin());
CREATE POLICY orgs_admin_update on organizations FOR UPDATE USING (is_admin());
CREATE POLICY orgs_admin_delete on organizations FOR DELETE USING (is_admin());

-- === Deployment Hubs: public read, admin write ===
ALTER TABLE deployment_hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY hubs_read on deployment_hubs FOR SELECT USING (true);
CREATE POLICY hubs_admin_write on deployment_hubs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY hubs_admin_update on deployment_hubs FOR UPDATE USING (is_admin());
CREATE POLICY hubs_admin_delete on deployment_hubs FOR DELETE USING (is_admin());

-- === Aid Categories: public read, admin write ===
ALTER TABLE aid_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY aid_cats_read on aid_categories FOR SELECT USING (true);
CREATE POLICY aid_cats_admin on aid_categories FOR INSERT WITH CHECK (is_admin());

-- === Hub Inventory: public read, admin write ===
ALTER TABLE hub_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY hub_inv_read on hub_inventory FOR SELECT USING (true);
CREATE POLICY hub_inv_admin_write on hub_inventory FOR INSERT WITH CHECK (is_admin());
CREATE POLICY hub_inv_admin_delete on hub_inventory FOR DELETE USING (is_admin());

-- === Needs: anon insert (via RPC), admin read + update ===
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY needs_admin_read on needs FOR SELECT USING (is_admin());
CREATE POLICY needs_anon_insert on needs FOR INSERT WITH CHECK (true);
CREATE POLICY needs_admin_update on needs FOR UPDATE USING (is_admin());

-- === Need Categories: anon insert via RPC, admin read ===
ALTER TABLE need_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY need_cats_anon_insert on need_categories FOR INSERT WITH CHECK (true);
CREATE POLICY need_cats_admin_read on need_categories FOR SELECT USING (is_admin());

-- === Hazards: anon insert, admin read + update ===
ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;
CREATE POLICY hazards_admin_read on hazards FOR SELECT USING (is_admin());
CREATE POLICY hazards_anon_insert on hazards FOR INSERT WITH CHECK (true);
CREATE POLICY hazards_admin_update on hazards FOR UPDATE USING (is_admin());

-- === Donations, Purchases, Deployments: admin-only everything ===
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY donations_admin_all on donations FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE donation_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY donation_cats_admin_all on donation_categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_admin_all on purchases FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE purchase_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_cats_admin_all on purchase_categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY deployments_admin_all on deployments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- === Admin Users: self or admin read; writes via edge function (service role) only ===
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_users_self_read on admin_users FOR SELECT USING (user_id = auth.uid());
CREATE POLICY admin_users_admin_read on admin_users FOR SELECT USING (is_admin());
-- No INSERT/UPDATE/DELETE policies: only service role (edge function) can mutate.
