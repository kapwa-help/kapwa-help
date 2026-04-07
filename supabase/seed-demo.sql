-- seed-demo.sql — Demo data for Kapwa Help dashboard prototype
-- Populates donations, deployments, submissions, purchases, and geographic diversity.
-- Run in the Supabase SQL Editor AFTER running schema.sql.
--
-- Safe to run multiple times: uses WHERE NOT EXISTS guards and ON CONFLICT.
-- To undo: DELETE FROM purchases WHERE notes = 'demo-seed';
--          DELETE FROM deployments WHERE notes IN ('demo-seed', 'demo-seed-linked');
--          DELETE FROM donations WHERE notes = 'demo-seed';
--          DELETE FROM submissions;
--          (then manually remove demo orgs, barangays, and event)

DO $$
DECLARE
  -- New organization IDs
  v_sjrrhass         uuid;
  v_surftown         uuid;
  v_feed_inc         uuid;
  v_starlight        uuid;
  v_greenpeace       uuid;
  v_art_relief       uuid;
  v_econest          uuid;
  v_doers            uuid;
  v_lu_volunteers    uuid;
  v_lu_surf          uuid;

  -- Existing organization IDs
  v_citizens         uuid;
  v_emerging         uuid;
  v_curma            uuid;
  v_waves4water      uuid;

  -- Event ID
  v_event          uuid;

  -- Aid category IDs (unified 9 categories)
  v_hot_meals        uuid;
  v_drinking_water   uuid;
  v_water_filt       uuid;
  v_temp_shelter     uuid;
  v_clothing         uuid;
  v_construction     uuid;
  v_medical          uuid;
  v_hygiene          uuid;
  v_canned_food      uuid;

  -- Barangay IDs
  v_brgy_urbiztondo    uuid;
  v_brgy_poblacion_sj  uuid;
  v_brgy_bacnotan      uuid;
  v_brgy_dili          uuid;
  v_brgy_central_east  uuid;
  v_brgy_paringao      uuid;
  v_brgy_nalvo         uuid;
  v_brgy_poblacion_lu  uuid;
  v_brgy_guerrero      uuid;
  v_brgy_baccuit       uuid;

  -- Submission IDs (for linking deployments)
  v_sub_nalvo_resolved     uuid;
  v_sub_nalvo_completed    uuid;
  v_sub_nalvo_intransit    uuid;
  v_sub_bauang_resolved    uuid;
  v_sub_bauang_completed   uuid;
  v_sub_bauang_intransit   uuid;
  v_sub_sanjuan_completed  uuid;
  v_sub_sanjuan_intransit  uuid;

BEGIN
  -- ============================================================
  -- 1. Ensure base organizations exist (idempotent via WHERE NOT EXISTS)
  -- ============================================================
  INSERT INTO organizations (name, municipality)
    SELECT 'Citizens for LU', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Citizens for LU');
  SELECT id INTO v_citizens FROM organizations WHERE name = 'Citizens for LU';

  INSERT INTO organizations (name, municipality)
    SELECT 'Emerging Islands', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Emerging Islands');
  SELECT id INTO v_emerging FROM organizations WHERE name = 'Emerging Islands';

  INSERT INTO organizations (name, municipality, lat, lng)
    SELECT 'CURMA', 'San Fernando', 16.6190, 120.3560
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'CURMA');
  SELECT id INTO v_curma FROM organizations WHERE name = 'CURMA';

  INSERT INTO organizations (name, municipality, lat, lng)
    SELECT 'Waves4Water', 'Agoo', 16.3240, 120.3660
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Waves4Water');
  SELECT id INTO v_waves4water FROM organizations WHERE name = 'Waves4Water';

  -- ============================================================
  -- 0. Insert demo event (idempotent via slug uniqueness)
  -- ============================================================
  INSERT INTO events (name, slug, description, region, started_at, is_active)
    VALUES (
      'Typhoon Emong Relief',
      'typhoon-emong',
      'Citizen-led disaster coordination for Typhoon Emong, La Union, Philippines',
      'La Union',
      '2026-03-24',
      true
    )
    ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_event FROM events WHERE slug = 'typhoon-emong';

  -- ============================================================
  -- 2. Ensure aid categories exist, then look them up
  -- ============================================================
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

  SELECT id INTO v_hot_meals      FROM aid_categories WHERE name = 'Hot Meals';
  SELECT id INTO v_drinking_water FROM aid_categories WHERE name = 'Drinking Water';
  SELECT id INTO v_water_filt     FROM aid_categories WHERE name = 'Water Filtration';
  SELECT id INTO v_temp_shelter   FROM aid_categories WHERE name = 'Temporary Shelter';
  SELECT id INTO v_clothing       FROM aid_categories WHERE name = 'Clothing';
  SELECT id INTO v_construction   FROM aid_categories WHERE name = 'Construction Materials';
  SELECT id INTO v_medical        FROM aid_categories WHERE name = 'Medical Supplies';
  SELECT id INTO v_hygiene        FROM aid_categories WHERE name = 'Hygiene Kits';
  SELECT id INTO v_canned_food    FROM aid_categories WHERE name = 'Canned Food';

  -- ============================================================
  -- 4. Insert new organizations (idempotent via WHERE NOT EXISTS)
  --    8 of 14 orgs have lat/lng (deployment hubs visible on map)
  -- ============================================================
  INSERT INTO organizations (name, municipality)
    SELECT 'SJRRHASS', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'SJRRHASS');
  SELECT id INTO v_sjrrhass FROM organizations WHERE name = 'SJRRHASS';

  INSERT INTO organizations (name, municipality)
    SELECT 'Surftown Pride', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Surftown Pride');
  SELECT id INTO v_surftown FROM organizations WHERE name = 'Surftown Pride';

  INSERT INTO organizations (name, municipality)
    SELECT 'FEED Inc', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'FEED Inc');
  SELECT id INTO v_feed_inc FROM organizations WHERE name = 'FEED Inc';

  INSERT INTO organizations (name, municipality, lat, lng)
    SELECT 'Starlight Raniag Tin San Juan', 'Balaoan', 16.7920, 120.3720
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Starlight Raniag Tin San Juan');
  SELECT id INTO v_starlight FROM organizations WHERE name = 'Starlight Raniag Tin San Juan';

  INSERT INTO organizations (name, municipality)
    SELECT 'Greenpeace Philippines', 'Manila'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Greenpeace Philippines');
  SELECT id INTO v_greenpeace FROM organizations WHERE name = 'Greenpeace Philippines';

  INSERT INTO organizations (name, municipality, lat, lng)
    SELECT 'Art Relief Mobile Kitchen', 'Bacnotan', 16.7360, 120.3580
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Art Relief Mobile Kitchen');
  SELECT id INTO v_art_relief FROM organizations WHERE name = 'Art Relief Mobile Kitchen';

  INSERT INTO organizations (name, municipality, lat, lng)
    SELECT 'EcoNest Sustainable Food Packaging', 'Bauang', 16.5370, 120.3500
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'EcoNest Sustainable Food Packaging');
  SELECT id INTO v_econest FROM organizations WHERE name = 'EcoNest Sustainable Food Packaging';

  INSERT INTO organizations (name, municipality, lat, lng)
    SELECT 'DOERS', 'Luna', 16.8090, 120.3770
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'DOERS');
  SELECT id INTO v_doers FROM organizations WHERE name = 'DOERS';

  INSERT INTO organizations (name, municipality, lat, lng)
    SELECT 'LU Citizen Volunteers', 'San Juan', 16.6710, 120.3440
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'LU Citizen Volunteers');
  SELECT id INTO v_lu_volunteers FROM organizations WHERE name = 'LU Citizen Volunteers';

  INSERT INTO organizations (name, municipality, lat, lng)
    SELECT 'La Union Surf Club', 'Aringay', 16.3980, 120.3600
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'La Union Surf Club');
  SELECT id INTO v_lu_surf FROM organizations WHERE name = 'La Union Surf Club';

  -- ============================================================
  -- 5. Insert barangays (idempotent via WHERE NOT EXISTS)
  -- ============================================================
  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Urbiztondo', 'San Juan', 16.6750, 120.3430, 4200
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Urbiztondo' AND municipality = 'San Juan');
  SELECT id INTO v_brgy_urbiztondo FROM barangays WHERE name = 'Urbiztondo' AND municipality = 'San Juan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Poblacion', 'San Juan', 16.6680, 120.3450, 3800
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Poblacion' AND municipality = 'San Juan');
  SELECT id INTO v_brgy_poblacion_sj FROM barangays WHERE name = 'Poblacion' AND municipality = 'San Juan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Bacnotan Proper', 'Bacnotan', 16.7370, 120.3570, 5100
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Bacnotan Proper' AND municipality = 'Bacnotan');
  SELECT id INTO v_brgy_bacnotan FROM barangays WHERE name = 'Bacnotan Proper' AND municipality = 'Bacnotan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Dili', 'Bacnotan', 16.7430, 120.3600, 2900
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Dili' AND municipality = 'Bacnotan');
  SELECT id INTO v_brgy_dili FROM barangays WHERE name = 'Dili' AND municipality = 'Bacnotan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Central East', 'Bauang', 16.5380, 120.3510, 3400
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Central East' AND municipality = 'Bauang');
  SELECT id INTO v_brgy_central_east FROM barangays WHERE name = 'Central East' AND municipality = 'Bauang';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Paringao', 'Bauang', 16.5200, 120.3460, 2800
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Paringao' AND municipality = 'Bauang');
  SELECT id INTO v_brgy_paringao FROM barangays WHERE name = 'Paringao' AND municipality = 'Bauang';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Nalvo Norte', 'Luna', 16.8120, 120.3780, 2100
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Nalvo Norte' AND municipality = 'Luna');
  SELECT id INTO v_brgy_nalvo FROM barangays WHERE name = 'Nalvo Norte' AND municipality = 'Luna';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Poblacion', 'Luna', 16.8050, 120.3760, 3200
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Poblacion' AND municipality = 'Luna');
  SELECT id INTO v_brgy_poblacion_lu FROM barangays WHERE name = 'Poblacion' AND municipality = 'Luna';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Guerrero', 'Bacnotan', 16.7280, 120.3590, 2400
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Guerrero' AND municipality = 'Bacnotan');
  SELECT id INTO v_brgy_guerrero FROM barangays WHERE name = 'Guerrero' AND municipality = 'Bacnotan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Baccuit Norte', 'Bauang', 16.5480, 120.3490, 3100
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Baccuit Norte' AND municipality = 'Bauang');
  SELECT id INTO v_brgy_baccuit FROM barangays WHERE name = 'Baccuit Norte' AND municipality = 'Bauang';

  -- New barangays for relocated hubs
  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Poblacion', 'San Fernando', 16.6180, 120.3550, 5500
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Poblacion' AND municipality = 'San Fernando');

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'San Marcos', 'Agoo', 16.3250, 120.3680, 3600
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'San Marcos' AND municipality = 'Agoo');

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Poblacion', 'Balaoan', 16.7910, 120.3730, 4100
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Poblacion' AND municipality = 'Balaoan');

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Poblacion', 'Aringay', 16.3990, 120.3610, 3200
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Poblacion' AND municipality = 'Aringay');

  -- ============================================================
  -- 6. Cash donations (guarded — skip if already seeded)
  --    13 entries across 8 orgs, totaling ~₱3.5M
  --    Dates: 2026-03-24 to 2026-04-06
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM donations WHERE notes = 'demo-seed' LIMIT 1) THEN
    INSERT INTO donations (organization_id, type, amount, date, notes) VALUES
      (v_sjrrhass,   'cash', 720000.00, '2026-03-24', 'demo-seed'),
      (v_citizens,   'cash', 510000.00, '2026-03-25', 'demo-seed'),
      (v_emerging,   'cash', 400000.00, '2026-03-26', 'demo-seed'),
      (v_surftown,   'cash', 350000.00, '2026-03-27', 'demo-seed'),
      (v_curma,      'cash', 290000.00, '2026-03-28', 'demo-seed'),
      (v_feed_inc,   'cash', 250000.00, '2026-03-29', 'demo-seed'),
      (v_starlight,  'cash', 200000.00, '2026-03-30', 'demo-seed'),
      (v_greenpeace, 'cash', 180000.00, '2026-03-31', 'demo-seed'),
      (v_sjrrhass,   'cash', 150000.00, '2026-04-01', 'demo-seed'),
      (v_citizens,   'cash', 120000.00, '2026-04-02', 'demo-seed'),
      (v_lu_volunteers, 'cash', 100000.00, '2026-04-03', 'demo-seed'),
      (v_doers,      'cash',  85000.00, '2026-04-04', 'demo-seed'),
      (v_lu_surf,    'cash',  75000.00, '2026-04-05', 'demo-seed');

    -- ============================================================
    -- 6b. In-kind donations (physical goods)
    --     10 entries with aid_category_id, quantity, unit
    -- ============================================================
    INSERT INTO donations (organization_id, type, aid_category_id, quantity, unit, date, notes) VALUES
      (v_art_relief,    'in_kind', v_hot_meals,      1700, 'meals',   '2026-03-25', 'demo-seed'),
      (v_art_relief,    'in_kind', v_canned_food,     900, 'packs',   '2026-03-26', 'demo-seed'),
      (v_econest,       'in_kind', v_canned_food,     600, 'packs',   '2026-03-26', 'demo-seed'),
      (v_waves4water,   'in_kind', v_water_filt,       80, 'filters', '2026-03-27', 'demo-seed'),
      (v_waves4water,   'in_kind', v_drinking_water,  500, 'cases',   '2026-03-28', 'demo-seed'),
      (v_lu_volunteers, 'in_kind', v_hygiene,         200, 'kits',    '2026-03-28', 'demo-seed'),
      (v_doers,         'in_kind', v_temp_shelter,    100, 'tarps',   '2026-03-29', 'demo-seed'),
      (v_curma,         'in_kind', v_clothing,        200, 'sets',    '2026-03-30', 'demo-seed'),
      (v_greenpeace,    'in_kind', v_medical,         300, 'kits',    '2026-03-31', 'demo-seed'),
      (v_starlight,     'in_kind', v_drinking_water,  500, 'bottles', '2026-04-01', 'demo-seed'),
      (v_feed_inc,      'in_kind', v_construction,    200, 'bundles', '2026-04-02', 'demo-seed'),
      (v_surftown,      'in_kind', v_hot_meals,       500, 'meals',   '2026-04-03', 'demo-seed'),
      (v_doers,         'in_kind', v_construction,    500, 'bundles', '2026-04-04', 'demo-seed'),
      (v_lu_surf,       'in_kind', v_hot_meals,       400, 'meals',   '2026-03-26', 'demo-seed'),
      (v_lu_surf,       'in_kind', v_canned_food,     500, 'packs',   '2026-03-27', 'demo-seed'),
      (v_lu_surf,       'in_kind', v_construction,    250, 'bundles', '2026-03-28', 'demo-seed'),
      (v_lu_surf,       'in_kind', v_medical,         300, 'kits',    '2026-03-29', 'demo-seed');
  END IF;

  -- ============================================================
  -- 7. Deployments — unlinked (guarded — skip if already seeded)
  --    ~20 entries with status = 'received' except 3 pending
  --    Dates: 2026-03-25 to 2026-04-05
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM deployments WHERE notes = 'demo-seed' LIMIT 1) THEN

    -- --- Art Relief Mobile Kitchen (Bacnotan) — 5 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_art_relief, v_hot_meals,       v_brgy_bacnotan, 520, 'meals',   '2026-03-25', 'demo-seed', 'received'),
      (v_art_relief, v_hot_meals,       v_brgy_dili,     480, 'meals',   '2026-03-27', 'demo-seed', 'received'),
      (v_art_relief, v_hot_meals,       v_brgy_guerrero, 450, 'meals',   '2026-03-30', 'demo-seed', 'received'),
      (v_art_relief, v_canned_food,     v_brgy_bacnotan, 380, 'packs',   '2026-03-28', 'demo-seed', 'received'),
      (v_art_relief, v_canned_food,     v_brgy_dili,     340, 'packs',   '2026-04-01', 'demo-seed', 'received');

    -- --- EcoNest (Bauang) — 5 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_econest, v_canned_food,     v_brgy_central_east, 420, 'packs',     '2026-03-26', 'demo-seed', 'received'),
      (v_econest, v_canned_food,     v_brgy_paringao,     380, 'packs',     '2026-03-28', 'demo-seed', 'received'),
      (v_econest, v_hot_meals,       v_brgy_central_east, 310, 'meals',     '2026-03-29', 'demo-seed', 'received'),
      (v_econest, v_hygiene,         v_brgy_baccuit,      160, 'kits',      '2026-04-02', 'demo-seed', 'received'),
      (v_econest, v_construction,    v_brgy_central_east, 120, 'sheets',    '2026-04-03', 'demo-seed', 'received');

    -- --- DOERS (Luna) — 4 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_doers, v_hot_meals,       v_brgy_nalvo,        460, 'meals',   '2026-03-27', 'demo-seed', 'received'),
      (v_doers, v_hot_meals,       v_brgy_poblacion_lu, 420, 'meals',   '2026-03-29', 'demo-seed', 'received'),
      (v_doers, v_canned_food,     v_brgy_nalvo,        350, 'packs',   '2026-03-30', 'demo-seed', 'received'),
      (v_doers, v_canned_food,     v_brgy_poblacion_lu, 280, 'packs',   '2026-04-01', 'demo-seed', 'received');

    -- --- LU Citizen Volunteers (San Juan) — 3 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_lu_volunteers, v_hot_meals,    v_brgy_urbiztondo,   500, 'meals', '2026-03-25', 'demo-seed', 'received'),
      (v_lu_volunteers, v_hot_meals,    v_brgy_poblacion_sj, 480, 'meals', '2026-03-28', 'demo-seed', 'received'),
      (v_lu_volunteers, v_canned_food,  v_brgy_urbiztondo,   360, 'packs', '2026-03-30', 'demo-seed', 'received');

    -- --- La Union Surf Club (Bauang) — 3 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_lu_surf, v_construction,    v_brgy_baccuit,      180, 'sheets', '2026-03-26', 'demo-seed', 'received'),
      (v_lu_surf, v_canned_food,     v_brgy_central_east, 320, 'packs',  '2026-04-01', 'demo-seed', 'received'),
      (v_lu_surf, v_hot_meals,       v_brgy_paringao,     260, 'meals',  '2026-04-03', 'demo-seed', 'received');

    -- --- Waves4Water (water/filtration) — 3 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_waves4water, v_water_filt,      v_brgy_bacnotan,     55, 'filters', '2026-03-27', 'demo-seed', 'received'),
      (v_waves4water, v_water_filt,      v_brgy_central_east, 48, 'filters', '2026-03-29', 'demo-seed', 'received'),
      (v_waves4water, v_drinking_water,  v_brgy_guerrero,    200, 'cases',   '2026-04-01', 'demo-seed', 'received');

    -- --- Medical & Hygiene (various orgs) — 3 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_art_relief,    v_medical,  v_brgy_bacnotan,     185, 'kits', '2026-04-04', 'demo-seed', 'received'),
      (v_econest,       v_medical,  v_brgy_central_east, 160, 'kits', '2026-04-04', 'demo-seed', 'received'),
      (v_doers,         v_hygiene,  v_brgy_poblacion_lu, 140, 'kits', '2026-04-04', 'demo-seed', 'received');

    -- --- Clothing (CURMA) ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_curma, v_clothing, v_brgy_urbiztondo, 150, 'sets', '2026-04-02', 'demo-seed', 'received'),
      (v_curma, v_clothing, v_brgy_poblacion_sj, 150, 'sets', '2026-04-03', 'demo-seed', 'received');

    -- --- Drinking water (Waves4Water + Starlight) ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_waves4water, v_drinking_water,  v_brgy_paringao, 180, 'cases',   '2026-04-03', 'demo-seed', 'received'),
      (v_starlight,   v_drinking_water,  v_brgy_nalvo,    220, 'bottles', '2026-04-02', 'demo-seed', 'received');

    -- --- Temporary Shelter ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_doers,         v_temp_shelter, v_brgy_nalvo,        100, 'tarps',  '2026-03-28', 'demo-seed', 'received'),
      (v_lu_volunteers, v_temp_shelter, v_brgy_poblacion_lu,  80, 'tarps',  '2026-03-31', 'demo-seed', 'received');

    -- --- Hygiene extras ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_lu_volunteers, v_hygiene,  v_brgy_urbiztondo,   100, 'kits', '2026-04-03', 'demo-seed', 'received'),
      (v_lu_surf,       v_medical,  v_brgy_baccuit,      120, 'kits', '2026-04-05', 'demo-seed', 'received');

  END IF;

  -- ============================================================
  -- 9. Insert demo needs — full lifecycle narrative
  --    15 submissions: 3 pending, 4 verified, 3 in_transit, 3 completed, 2 resolved
  --    Dates: 2026-03-25 to 2026-04-06
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM submissions LIMIT 1) THEN

    -- ── Thread 1: Nalvo Flood (Luna, temporary shelter) ──────────────────
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'resolved', 'Kap. Dante Soriano', v_brgy_nalvo, v_temp_shelter, 16.8128, 120.3785, 'foot_only', 30, 'critical',
              45, 30, 10,
              '30 homes destroyed by flash flood — tarps and lumber delivered by DOERS, families rebuilt',
              '2026-03-26 10:00:00+08', '2026-03-30 14:00:00+08', '2026-03-25 06:30:00+08')
      RETURNING id INTO v_sub_nalvo_resolved;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'completed', 'Ldr. Carmen Valdez', v_brgy_nalvo, v_temp_shelter, 16.8115, 120.3790, 'foot_only', 20, 'high',
              30, 18, 6,
              'Second wave — 20 families displaced upstream, DOERS delivered tarps and building materials',
              '2026-03-27 09:00:00+08', '2026-04-01 11:00:00+08', '2026-03-26 07:00:00+08')
      RETURNING id INTO v_sub_nalvo_completed;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, created_at)
      VALUES (v_event, 'in_transit', 'Vol. Rico Agustin', v_brgy_poblacion_lu, v_temp_shelter, 16.8055, 120.3765, 'cut_off', 15, 'high',
              22, 12, 4,
              'Additional families found further upstream — Art Relief sending construction materials',
              '2026-03-28 11:00:00+08', '2026-03-27 08:00:00+08')
      RETURNING id INTO v_sub_nalvo_intransit;

    -- ── Thread 2: Bauang Medical Emergency ─────────────────────────
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'resolved', 'Kap. Elena Ramos', v_brgy_baccuit, v_medical, 16.5485, 120.3495, 'truck', 35, 'high',
              50, 20, 8,
              'Debris injuries across Baccuit Norte — La Union Surf Club delivered 120 medical kits, all treated',
              '2026-03-26 09:00:00+08', '2026-03-30 16:00:00+08', '2026-03-25 07:00:00+08')
      RETURNING id INTO v_sub_bauang_resolved;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'completed', 'Ldr. Paolo Cruz', v_brgy_central_east, v_medical, 16.5385, 120.3515, 'truck', 25, 'medium',
              35, 10, 5,
              'Minor injuries and infections in Central East — EcoNest delivered medical supplies',
              '2026-03-27 10:00:00+08', '2026-04-01 13:00:00+08', '2026-03-26 08:30:00+08')
      RETURNING id INTO v_sub_bauang_completed;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, created_at)
      VALUES (v_event, 'in_transit', 'Vol. Lisa Fernandez', v_brgy_paringao, v_medical, 16.5205, 120.3465, 'boat', 40, 'critical',
              60, 25, 12,
              'Flooding cut road to Paringao — boat-access only, LU Citizen Volunteers en route with medical kits',
              '2026-03-28 08:00:00+08', '2026-03-27 06:00:00+08')
      RETURNING id INTO v_sub_bauang_intransit;

    -- ── Thread 3: San Juan Food Shortage ───────────────────────────
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'completed', 'Kap. Maria Santos', v_brgy_poblacion_sj, v_hot_meals, 16.6685, 120.3455, 'truck', 70, 'high',
              100, 45, 15,
              'Poblacion families running out of food — LU Citizen Volunteers delivered 480 meals',
              '2026-03-26 08:00:00+08', '2026-03-30 10:00:00+08', '2026-03-25 06:00:00+08')
      RETURNING id INTO v_sub_sanjuan_completed;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, created_at)
      VALUES (v_event, 'in_transit', 'Ldr. Jose Reyes', v_brgy_urbiztondo, v_hot_meals, 16.6755, 120.3435, 'truck', 50, 'high',
              70, 30, 10,
              'Urbiztondo supplies critical — LU Citizen Volunteers sending relief goods',
              '2026-03-27 10:00:00+08', '2026-03-26 07:30:00+08')
      RETURNING id INTO v_sub_sanjuan_intransit;

    -- ── Verified needs awaiting donor response ──────────────────
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, created_at) VALUES
      (v_event, 'verified', 'Vol. Rica Tan', v_brgy_urbiztondo, v_hot_meals, 16.6745, 120.3425, 'truck', 30, 'medium',
       40, 20, 5,
       'Second neighborhood in Urbiztondo reporting food shortage — families sharing remaining supplies',
       '2026-03-30 09:00:00+08', '2026-03-29 07:00:00+08'),
      (v_event, 'verified', 'Ldr. Teresa Aquino', v_brgy_poblacion_sj, v_canned_food, 16.6675, 120.3445, 'truck', 20, 'medium',
       25, 5, 12,
       'Elderly residents in Poblacion need special dietary provisions — regular relief goods insufficient',
       '2026-03-31 11:00:00+08', '2026-03-30 08:00:00+08'),
      (v_event, 'verified', 'Vol. Marco Diaz', v_brgy_paringao, v_medical, 16.5210, 120.3470, 'boat', 15, 'high',
       20, 8, 3,
       'Additional injuries discovered in Paringao — need more first aid supplies beyond initial delivery',
       '2026-04-01 10:00:00+08', '2026-03-31 08:00:00+08'),
      (v_event, 'verified', 'Kap. Luis Aquino', v_brgy_bacnotan, v_temp_shelter, 16.7375, 120.3575, '4x4', 25, 'high',
       35, 20, 8,
       'Road partially blocked by landslide — 25 families need roofing materials, 4x4 can reach',
       '2026-04-02 14:00:00+08', '2026-04-01 11:00:00+08');

    -- ── Pending (unverified reports awaiting triage) ────────────
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, created_at) VALUES
      (v_event, 'pending', 'Caller: unknown', v_brgy_dili, v_canned_food, 16.7435, 120.3605, '4x4', 45, 'critical',
       0, 0, 0,
       'Unverified phone report — community behind collapsed bridge, food running out',
       '2026-04-04 06:00:00+08'),
      (v_event, 'pending', 'Caller: Juan dela Cruz', v_brgy_guerrero, v_medical, 16.7285, 120.3595, 'truck', 20, 'medium',
       0, 0, 0,
       'Walk-in report at relief center — says neighbors have untreated cuts, needs verification',
       '2026-04-05 09:00:00+08'),
      (v_event, 'pending', 'SMS: +63 9XX XXX XXXX', v_brgy_poblacion_lu, v_temp_shelter, 16.8045, 120.3755, 'cut_off', NULL, 'critical',
       0, 0, 0,
       'SMS received — sender says multiple houses collapsed, area cut off, quantity unknown',
       '2026-04-06 11:00:00+08');

  END IF;

  -- ============================================================
  -- 10. Linked deployments (fulfill specific needs)
  --     8 entries, tagged 'demo-seed-linked' for independent teardown.
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM deployments WHERE notes = 'demo-seed-linked' LIMIT 1) THEN

    -- Thread 1: DOERS responded to Nalvo shelter crisis
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_doers, v_construction, v_brgy_nalvo, v_sub_nalvo_resolved,  200, 'sheets', '2026-03-28', 'demo-seed-linked', 'received'),
      (v_event, v_doers, v_construction, v_brgy_nalvo, v_sub_nalvo_completed, 150, 'sheets', '2026-03-30', 'demo-seed-linked', 'received');

    -- Thread 1: Art Relief sending materials to upstream families
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_art_relief, v_construction, v_brgy_poblacion_lu, v_sub_nalvo_intransit, 100, 'sheets', '2026-04-01', 'demo-seed-linked', 'pending');

    -- Thread 2: La Union Surf Club responded to Baccuit medical need
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_lu_surf, v_medical, v_brgy_baccuit, v_sub_bauang_resolved, 120, 'kits', '2026-03-27', 'demo-seed-linked', 'received');

    -- Thread 2: EcoNest responded to Central East medical need
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_econest, v_medical, v_brgy_central_east, v_sub_bauang_completed, 160, 'kits', '2026-03-29', 'demo-seed-linked', 'received');

    -- Thread 2: LU Citizen Volunteers en route to Paringao with medical kits
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_lu_volunteers, v_medical, v_brgy_paringao, v_sub_bauang_intransit, 80, 'kits', '2026-04-01', 'demo-seed-linked', 'pending');

    -- Thread 3: LU Citizen Volunteers delivered meals to Poblacion SJ
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_lu_volunteers, v_hot_meals, v_brgy_poblacion_sj, v_sub_sanjuan_completed, 480, 'meals', '2026-03-28', 'demo-seed-linked', 'received');

    -- Thread 3: LU Citizen Volunteers sending canned food to Urbiztondo
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_lu_volunteers, v_canned_food, v_brgy_urbiztondo, v_sub_sanjuan_intransit, 350, 'packs', '2026-03-30', 'demo-seed-linked', 'pending');

  END IF;

  -- ============================================================
  -- 11. Purchases (goods bought with donations)
  --     15 entries, balanced with in-kind donations to exceed deployments
  --     Dates: 2026-03-26 to 2026-04-05
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM purchases WHERE notes = 'demo-seed' LIMIT 1) THEN
    INSERT INTO purchases (event_id, organization_id, aid_category_id, quantity, unit, cost, date, notes) VALUES
      (v_event, v_sjrrhass,     v_hot_meals,       2000, 'meals',   100000.00, '2026-03-26', 'demo-seed'),
      (v_event, v_feed_inc,     v_hot_meals,       1500, 'meals',    75000.00, '2026-03-28', 'demo-seed'),
      (v_event, v_feed_inc,     v_drinking_water,  2000, 'bottles',  30000.00, '2026-03-27', 'demo-seed'),
      (v_event, v_econest,      v_canned_food,     1500, 'packs',    90000.00, '2026-03-28', 'demo-seed'),
      (v_event, v_citizens,     v_canned_food,     1400, 'packs',    84000.00, '2026-03-30', 'demo-seed'),
      (v_event, v_starlight,    v_medical,          500, 'kits',    250000.00, '2026-03-29', 'demo-seed'),
      (v_event, v_emerging,     v_construction,     400, 'bundles', 200000.00, '2026-03-31', 'demo-seed'),
      (v_event, v_curma,        v_clothing,         300, 'sets',     96000.00, '2026-04-01', 'demo-seed'),
      (v_event, v_waves4water,  v_water_filt,       170, 'units',   425000.00, '2026-03-30', 'demo-seed'),
      (v_event, v_econest,      v_hygiene,          500, 'kits',    100000.00, '2026-04-02', 'demo-seed'),
      (v_event, v_econest,      v_hot_meals,        500, 'meals',    25000.00, '2026-04-02', 'demo-seed'),
      (v_event, v_econest,      v_construction,     200, 'bundles', 100000.00, '2026-04-03', 'demo-seed'),
      (v_event, v_econest,      v_medical,          250, 'kits',    125000.00, '2026-04-03', 'demo-seed'),
      (v_event, v_sjrrhass,     v_temp_shelter,     300, 'tarps',    60000.00, '2026-04-01', 'demo-seed'),
      (v_event, v_lu_volunteers, v_hot_meals,      1700, 'meals',    85000.00, '2026-04-03', 'demo-seed'),
      (v_event, v_lu_volunteers, v_canned_food,    500, 'packs',    30000.00, '2026-04-03', 'demo-seed'),
      (v_event, v_lu_volunteers, v_temp_shelter,   120, 'tarps',    24000.00, '2026-04-04', 'demo-seed'),
      (v_event, v_doers,        v_canned_food,      800, 'packs',    48000.00, '2026-04-03', 'demo-seed'),
      (v_event, v_doers,        v_hot_meals,       1100, 'meals',    55000.00, '2026-04-03', 'demo-seed'),
      (v_event, v_doers,        v_hygiene,          200, 'kits',     40000.00, '2026-04-04', 'demo-seed'),
      (v_event, v_art_relief,   v_medical,          200, 'kits',    100000.00, '2026-04-04', 'demo-seed'),
      (v_event, v_surftown,     v_hygiene,          200, 'kits',     40000.00, '2026-04-05', 'demo-seed');
  END IF;

  -- ============================================================
  -- 12. Hazards (environmental hazards on the map)
  --     6 entries: mix of active/resolved, varied types
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM hazards WHERE reported_by = 'demo-seed' LIMIT 1) THEN
    INSERT INTO hazards (event_id, hazard_type, description, latitude, longitude, status, reported_by, created_at) VALUES
      (v_event, 'flood',             'Flash flooding along Nalvo Norte river — water level 1.5m above normal, multiple homes submerged',
       16.8130, 120.3790, 'active',   'demo-seed', '2026-03-25 07:00:00+08'),
      (v_event, 'landslide',         'Hillside collapse partially blocking Bacnotan–Luna road, single lane passable by 4x4',
       16.7400, 120.3610, 'resolved', 'demo-seed', '2026-03-26 06:30:00+08'),
      (v_event, 'bridge_out',        'Concrete bridge to Dili barangay collapsed — foot crossing only via temporary bamboo walkway',
       16.7440, 120.3610, 'active',   'demo-seed', '2026-03-25 09:00:00+08'),
      (v_event, 'road_blocked',      'Fallen trees and debris blocking coastal road to Paringao — boat access recommended',
       16.5190, 120.3450, 'active',   'demo-seed', '2026-03-26 08:00:00+08'),
      (v_event, 'electrical_hazard', 'Downed power lines near Central East evacuation center — LUECO notified, area cordoned off',
       16.5390, 120.3520, 'resolved', 'demo-seed', '2026-03-27 11:00:00+08'),
      (v_event, 'flood',             'Rising water in Poblacion Luna from upstream runoff — families in low-lying areas evacuating',
       16.8060, 120.3770, 'active',   'demo-seed', '2026-03-28 06:00:00+08');
  END IF;

  -- Link existing deployments to the event
  UPDATE deployments SET event_id = v_event WHERE notes IN ('demo-seed', 'demo-seed-linked');

  RAISE NOTICE 'Demo seed complete! (Typhoon Emong Relief, 2026-03-24 to 2026-04-06)';
END $$;
