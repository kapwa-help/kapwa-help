-- ============================================================
-- Kapwa Help — V1 Demo Seed Data
-- ============================================================
-- Self-contained, idempotent. Run after schema.sql.

-- Use fixed UUIDs so we can reference them across inserts.

-- ============================================================
-- Event
-- ============================================================
INSERT INTO events (id, name, slug, description, region, started_at, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Typhoon Emong Relief', 'typhoon-emong',
   'Community-led relief coordination for Typhoon Emong affecting La Union province.',
   'La Union', '2026-03-24', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Organizations
-- ============================================================
INSERT INTO organizations (id, event_id, name, description, contact_info) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Citizens for La Union', 'Local civic org coordinating donations', 'info@citizensforlu.ph'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Buhaki LU Chapter', 'Volunteer rescue and relief group', NULL),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Art Relief Mobile Kitchen', 'Hot meals for displaced communities', 'artrelief@gmail.com'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'LU Disaster Response', 'Provincial government disaster response unit', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Deployment Hubs (independent from orgs, with lat/lng)
-- ============================================================
INSERT INTO deployment_hubs (id, event_id, name, lat, lng, description, notes) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'San Juan Municipal Hall', 16.6619, 120.3269, 'Main coordination center',
   'Open 24/7 during relief ops. Running low on hot meals — requesting more rice and canned goods. Volunteers needed for evening shifts. Coordinator: Mayor''s Office, 0917-555-0101.'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Bacnotan Community Center', 16.7314, 120.3494, 'Northern relief staging area',
   'Staging area currently at ~80% capacity. Urgent need for blankets and children''s clothing for evacuees. Contact Brgy. Capt. Reyes at 0917-555-0202.'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'San Fernando City Hall', 16.6159, 120.3167, 'Provincial capital hub',
   'Serves as backup comms center. Supplies adequate. Looking for volunteers for Saturday and Sunday shifts. Satellite phone available for remote coordination.'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Bauang Relief Center', 16.5328, 120.3378, 'Southern relief distribution',
   'Southern distribution point. Drinking water stock lasts ~2 days — resupply requested. Medical team on-site until 6 PM daily. Bridge access OK via truck.'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Luna Emergency Shelter', 16.8555, 120.3803, 'Emergency shelter for evacuees',
   'Capacity: ~200 people (currently sheltering 145). Need hygiene kits and additional cots. Road access via 4x4 only after landslide at km 14.')
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  notes = EXCLUDED.notes;

-- ============================================================
-- Hub Inventory (which categories each hub has)
-- ============================================================
DO $$
DECLARE
  cat_hot_meals uuid;
  cat_water uuid;
  cat_filtration uuid;
  cat_shelter uuid;
  cat_clothing uuid;
  cat_construction uuid;
  cat_medical uuid;
  cat_hygiene uuid;
  cat_canned uuid;
BEGIN
  SELECT id INTO cat_hot_meals FROM aid_categories WHERE name = 'Hot Meals';
  SELECT id INTO cat_water FROM aid_categories WHERE name = 'Drinking Water';
  SELECT id INTO cat_filtration FROM aid_categories WHERE name = 'Water Filtration';
  SELECT id INTO cat_shelter FROM aid_categories WHERE name = 'Temporary Shelter';
  SELECT id INTO cat_clothing FROM aid_categories WHERE name = 'Clothing';
  SELECT id INTO cat_construction FROM aid_categories WHERE name = 'Construction Materials';
  SELECT id INTO cat_medical FROM aid_categories WHERE name = 'Medical Supplies';
  SELECT id INTO cat_hygiene FROM aid_categories WHERE name = 'Hygiene Kits';
  SELECT id INTO cat_canned FROM aid_categories WHERE name = 'Canned Food';

  -- San Juan hub: hot meals, water, medical
  INSERT INTO hub_inventory (hub_id, aid_category_id) VALUES
    ('c0000000-0000-0000-0000-000000000001', cat_hot_meals),
    ('c0000000-0000-0000-0000-000000000001', cat_water),
    ('c0000000-0000-0000-0000-000000000001', cat_medical)
  ON CONFLICT DO NOTHING;

  -- Bacnotan hub: shelter, clothing, canned food
  INSERT INTO hub_inventory (hub_id, aid_category_id) VALUES
    ('c0000000-0000-0000-0000-000000000002', cat_shelter),
    ('c0000000-0000-0000-0000-000000000002', cat_clothing),
    ('c0000000-0000-0000-0000-000000000002', cat_canned)
  ON CONFLICT DO NOTHING;

  -- San Fernando hub: water filtration, hygiene, medical
  INSERT INTO hub_inventory (hub_id, aid_category_id) VALUES
    ('c0000000-0000-0000-0000-000000000003', cat_filtration),
    ('c0000000-0000-0000-0000-000000000003', cat_hygiene),
    ('c0000000-0000-0000-0000-000000000003', cat_medical)
  ON CONFLICT DO NOTHING;

  -- Bauang hub: hot meals, canned food
  INSERT INTO hub_inventory (hub_id, aid_category_id) VALUES
    ('c0000000-0000-0000-0000-000000000004', cat_hot_meals),
    ('c0000000-0000-0000-0000-000000000004', cat_canned)
  ON CONFLICT DO NOTHING;

  -- Luna hub: shelter, construction materials
  INSERT INTO hub_inventory (hub_id, aid_category_id) VALUES
    ('c0000000-0000-0000-0000-000000000005', cat_shelter),
    ('c0000000-0000-0000-0000-000000000005', cat_construction)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- Needs (8 needs across different statuses)
  -- ============================================================
  INSERT INTO needs (id, event_id, hub_id, lat, lng, access_status, urgency, status, num_people, contact_name, contact_phone, notes) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL,
     16.6734, 120.3145, 'truck', 'high', 'pending', 45,
     'Maria Santos', '09171234567', 'Flooded area near river, families on rooftops'),
    ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL,
     16.7012, 120.3389, '4x4', 'critical', 'verified', 120,
     'Juan Dela Cruz', '09189876543', 'Landslide blocked main road, no food for 2 days'),
    ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001', 16.6555, 120.3201, 'truck', 'medium', 'in_transit', 30,
     'Ana Reyes', NULL, 'Elderly residents need medical supplies'),
    ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000002', 16.7456, 120.3567, 'boat', 'high', 'confirmed', 85,
     'Pedro Garcia', '09201112233', 'Island community, boat access only'),
    ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', NULL,
     16.5912, 120.3289, 'foot_only', 'critical', 'pending', 60,
     'Rosa Fernandez', '09153334455', 'Mountain village, bridge washed out'),
    ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', NULL,
     16.6289, 120.3098, 'cut_off', 'high', 'verified', 200,
     'Carlos Mendoza', NULL, 'Entire sitio cut off by flooding'),
    ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000004', 16.5401, 120.3445, 'truck', 'low', 'confirmed', 25,
     'Elena Ramos', '09167778899', 'Minor needs, already partially served'),
    ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', NULL,
     16.8123, 120.3612, '4x4', 'medium', 'in_transit', 55,
     'Miguel Torres', '09192223344', 'Remote barangay, needs hygiene kits')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- Need Categories (multi-select per need)
  -- ============================================================
  INSERT INTO need_categories (need_id, aid_category_id) VALUES
    ('d0000000-0000-0000-0000-000000000001', cat_hot_meals),
    ('d0000000-0000-0000-0000-000000000001', cat_water),
    ('d0000000-0000-0000-0000-000000000002', cat_canned),
    ('d0000000-0000-0000-0000-000000000002', cat_water),
    ('d0000000-0000-0000-0000-000000000002', cat_shelter),
    ('d0000000-0000-0000-0000-000000000003', cat_medical),
    ('d0000000-0000-0000-0000-000000000004', cat_hot_meals),
    ('d0000000-0000-0000-0000-000000000004', cat_clothing),
    ('d0000000-0000-0000-0000-000000000004', cat_hygiene),
    ('d0000000-0000-0000-0000-000000000005', cat_construction),
    ('d0000000-0000-0000-0000-000000000005', cat_shelter),
    ('d0000000-0000-0000-0000-000000000006', cat_water),
    ('d0000000-0000-0000-0000-000000000006', cat_filtration),
    ('d0000000-0000-0000-0000-000000000006', cat_hot_meals),
    ('d0000000-0000-0000-0000-000000000007', cat_canned),
    ('d0000000-0000-0000-0000-000000000008', cat_hygiene),
    ('d0000000-0000-0000-0000-000000000008', cat_clothing)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- Donations (cash and in-kind)
  -- ============================================================
  INSERT INTO donations (id, event_id, organization_id, donor_name, donor_type, type, amount, date, notes) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001', 'Overseas Filipino Workers Assoc.', 'organization', 'cash',
     500000.00, '2026-03-25', 'Emergency fund from OFW community'),
    ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001', 'Gov. Ricardo Ortega', 'individual', 'cash',
     200000.00, '2026-03-26', NULL),
    ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000002', NULL, NULL, 'cash',
     150000.00, '2026-03-27', 'Anonymous donor via GCash'),
    ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000003', 'San Juan Lions Club', 'organization', 'cash',
     300000.00, '2026-03-28', NULL),
    ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000004', 'LU Chamber of Commerce', 'organization', 'cash',
     750000.00, '2026-03-29', 'Business community relief fund'),
    ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000003', 'Red Cross LU', 'organization', 'in_kind',
     NULL, '2026-03-26', 'Medical supplies and hygiene kits'),
    ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000002', 'Barangay Urbiztondo', 'organization', 'in_kind',
     NULL, '2026-03-27', 'Hot meals for 3 days'),
    ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001', 'Manila Volunteers', 'organization', 'in_kind',
     NULL, '2026-03-28', 'Clothing and blankets')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- Donation Categories (for in-kind)
  -- ============================================================
  INSERT INTO donation_categories (donation_id, aid_category_id) VALUES
    ('e0000000-0000-0000-0000-000000000006', cat_medical),
    ('e0000000-0000-0000-0000-000000000006', cat_hygiene),
    ('e0000000-0000-0000-0000-000000000007', cat_hot_meals),
    ('e0000000-0000-0000-0000-000000000008', cat_clothing)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- Purchases
  -- ============================================================
  INSERT INTO purchases (id, event_id, organization_id, cost, date, notes) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001', 85000.00, '2026-03-27', 'Bulk water purchase from supplier'),
    ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000003', 120000.00, '2026-03-28', 'Hot meals ingredients for 500 servings'),
    ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000004', 250000.00, '2026-03-29', 'Temporary shelter materials'),
    ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000002', 45000.00, '2026-03-30', 'Hygiene kits assembly')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- Purchase Categories
  -- ============================================================
  INSERT INTO purchase_categories (purchase_id, aid_category_id) VALUES
    ('f0000000-0000-0000-0000-000000000001', cat_water),
    ('f0000000-0000-0000-0000-000000000002', cat_hot_meals),
    ('f0000000-0000-0000-0000-000000000003', cat_shelter),
    ('f0000000-0000-0000-0000-000000000003', cat_construction),
    ('f0000000-0000-0000-0000-000000000004', cat_hygiene)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- Hazards
-- ============================================================
INSERT INTO hazards (id, event_id, description, photo_url, latitude, longitude, status, reported_by) VALUES
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Major flooding along Bauang River — water level 2m above normal', '/demo-hazards/flooding.jpg', 16.5412, 120.3301, 'active', 'MDRRMO Bauang'),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Landslide blocking Naguilian Road km 14', '/demo-hazards/landslide.jpg', 16.5189, 120.3956, 'active', 'PNP Naguilian'),
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Downed power lines near Bacnotan market', '/demo-hazards/power-lines.jpg', 16.7289, 120.3512, 'active', NULL),
  ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Bridge weakened at San Gabriel crossing — do not use heavy vehicles', '/demo-hazards/bridge.jpg', 16.6945, 120.4123, 'resolved', 'DPWH La Union')
ON CONFLICT (id) DO UPDATE SET photo_url = EXCLUDED.photo_url;

-- ============================================================
-- Deployments (for confirmed needs)
-- ============================================================
INSERT INTO deployments (id, event_id, hub_id, need_id, date, notes) VALUES
  ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004',
   '2026-03-30', 'Boat delivery coordinated with coast guard'),
  ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000007',
   '2026-04-01', 'Regular truck delivery')
ON CONFLICT DO NOTHING;
