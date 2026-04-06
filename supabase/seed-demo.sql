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

  -- Submission IDs (for linking deployments in §10)
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
  --    These were originally created by seed-kml.ts; creating them here
  --    makes seed-demo.sql self-contained.
  -- ============================================================
  INSERT INTO organizations (name, municipality)
    SELECT 'Citizens for LU', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Citizens for LU');
  SELECT id INTO v_citizens FROM organizations WHERE name = 'Citizens for LU';

  INSERT INTO organizations (name, municipality)
    SELECT 'Emerging Islands', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Emerging Islands');
  SELECT id INTO v_emerging FROM organizations WHERE name = 'Emerging Islands';

  INSERT INTO organizations (name, municipality)
    SELECT 'CURMA', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'CURMA');
  SELECT id INTO v_curma FROM organizations WHERE name = 'CURMA';

  INSERT INTO organizations (name, municipality)
    SELECT 'Waves4Water', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Waves4Water');
  SELECT id INTO v_waves4water FROM organizations WHERE name = 'Waves4Water';

  -- ============================================================
  -- 0. Insert demo event (idempotent via slug uniqueness)
  -- ============================================================
  INSERT INTO events (name, slug, description, region, started_at, is_active)
    VALUES (
      'La Union Relief Operations',
      'la-union-relief',
      'Citizen-led disaster coordination for La Union, Philippines',
      'La Union',
      '2024-11-10',
      true
    )
    ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_event FROM events WHERE slug = 'la-union-relief';

  -- ============================================================
  -- 2. Look up aid categories (unified 9-category list)
  -- ============================================================
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

  INSERT INTO organizations (name, municipality)
    SELECT 'Starlight Raniag Tin San Juan', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Starlight Raniag Tin San Juan');
  SELECT id INTO v_starlight FROM organizations WHERE name = 'Starlight Raniag Tin San Juan';

  INSERT INTO organizations (name, municipality)
    SELECT 'Greenpeace Philippines', 'Manila'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Greenpeace Philippines');
  SELECT id INTO v_greenpeace FROM organizations WHERE name = 'Greenpeace Philippines';

  INSERT INTO organizations (name, municipality)
    SELECT 'Art Relief Mobile Kitchen', 'Bacnotan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Art Relief Mobile Kitchen');
  SELECT id INTO v_art_relief FROM organizations WHERE name = 'Art Relief Mobile Kitchen';

  INSERT INTO organizations (name, municipality)
    SELECT 'EcoNest Sustainable Food Packaging', 'Bauang'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'EcoNest Sustainable Food Packaging');
  SELECT id INTO v_econest FROM organizations WHERE name = 'EcoNest Sustainable Food Packaging';

  INSERT INTO organizations (name, municipality)
    SELECT 'DOERS', 'Luna'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'DOERS');
  SELECT id INTO v_doers FROM organizations WHERE name = 'DOERS';

  INSERT INTO organizations (name, municipality)
    SELECT 'LU Citizen Volunteers', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'LU Citizen Volunteers');
  SELECT id INTO v_lu_volunteers FROM organizations WHERE name = 'LU Citizen Volunteers';

  INSERT INTO organizations (name, municipality)
    SELECT 'La Union Surf Club', 'Bauang'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'La Union Surf Club');
  SELECT id INTO v_lu_surf FROM organizations WHERE name = 'La Union Surf Club';

  -- ============================================================
  -- 5. Insert barangays (idempotent via WHERE NOT EXISTS)
  -- ============================================================
  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Urbiztondo', 'San Juan', 16.6681, 120.3225, 4200
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Urbiztondo' AND municipality = 'San Juan');
  SELECT id INTO v_brgy_urbiztondo FROM barangays WHERE name = 'Urbiztondo' AND municipality = 'San Juan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Poblacion', 'San Juan', 16.6636, 120.3287, 3800
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Poblacion' AND municipality = 'San Juan');
  SELECT id INTO v_brgy_poblacion_sj FROM barangays WHERE name = 'Poblacion' AND municipality = 'San Juan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Bacnotan Proper', 'Bacnotan', 16.7332, 120.3489, 5100
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Bacnotan Proper' AND municipality = 'Bacnotan');
  SELECT id INTO v_brgy_bacnotan FROM barangays WHERE name = 'Bacnotan Proper' AND municipality = 'Bacnotan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Dili', 'Bacnotan', 16.7412, 120.3520, 2900
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Dili' AND municipality = 'Bacnotan');
  SELECT id INTO v_brgy_dili FROM barangays WHERE name = 'Dili' AND municipality = 'Bacnotan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Central East', 'Bauang', 16.5370, 120.3395, 3400
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Central East' AND municipality = 'Bauang');
  SELECT id INTO v_brgy_central_east FROM barangays WHERE name = 'Central East' AND municipality = 'Bauang';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Paringao', 'Bauang', 16.5140, 120.3280, 2800
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Paringao' AND municipality = 'Bauang');
  SELECT id INTO v_brgy_paringao FROM barangays WHERE name = 'Paringao' AND municipality = 'Bauang';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Nalvo Norte', 'Luna', 16.8080, 120.3680, 2100
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Nalvo Norte' AND municipality = 'Luna');
  SELECT id INTO v_brgy_nalvo FROM barangays WHERE name = 'Nalvo Norte' AND municipality = 'Luna';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Poblacion', 'Luna', 16.8008, 120.3729, 3200
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Poblacion' AND municipality = 'Luna');
  SELECT id INTO v_brgy_poblacion_lu FROM barangays WHERE name = 'Poblacion' AND municipality = 'Luna';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Guerrero', 'Bacnotan', 16.7250, 120.3540, 2400
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Guerrero' AND municipality = 'Bacnotan');
  SELECT id INTO v_brgy_guerrero FROM barangays WHERE name = 'Guerrero' AND municipality = 'Bacnotan';

  INSERT INTO barangays (name, municipality, lat, lng, population)
    SELECT 'Baccuit Norte', 'Bauang', 16.5460, 120.3310, 3100
    WHERE NOT EXISTS (SELECT 1 FROM barangays WHERE name = 'Baccuit Norte' AND municipality = 'Bauang');
  SELECT id INTO v_brgy_baccuit FROM barangays WHERE name = 'Baccuit Norte' AND municipality = 'Bauang';

  -- ============================================================
  -- 6. Insert donations (guarded — skip if already seeded)
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM donations WHERE notes = 'demo-seed' LIMIT 1) THEN
    INSERT INTO donations (organization_id, amount, date, notes) VALUES
      (v_sjrrhass,   720000.00, '2024-11-10', 'demo-seed'),
      (v_citizens,   510000.00, '2024-11-12', 'demo-seed'),
      (v_emerging,   400000.00, '2024-11-14', 'demo-seed'),
      (v_surftown,   350000.00, '2024-11-15', 'demo-seed'),
      (v_curma,      290000.00, '2024-11-16', 'demo-seed'),
      (v_feed_inc,   250000.00, '2024-11-18', 'demo-seed'),
      (v_starlight,  200000.00, '2024-11-20', 'demo-seed'),
      (v_greenpeace, 127500.00, '2024-11-22', 'demo-seed');
  END IF;

  -- ============================================================
  -- 7. Insert deployments (guarded — skip if already seeded)
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM deployments WHERE notes = 'demo-seed' LIMIT 1) THEN

    -- --- Art Relief Mobile Kitchen (Bacnotan) — 8 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_art_relief, v_hot_meals,       v_brgy_bacnotan, 520, 'meals',   '2024-11-11', 'demo-seed', 'received'),
      (v_art_relief, v_hot_meals,       v_brgy_dili,     480, 'meals',   '2024-11-13', 'demo-seed', 'received'),
      (v_art_relief, v_hot_meals,       v_brgy_guerrero, 450, 'meals',   '2024-11-16', 'demo-seed', 'received'),
      (v_art_relief, v_canned_food,     v_brgy_bacnotan, 380, 'packs',   '2024-11-14', 'demo-seed', 'received'),
      (v_art_relief, v_canned_food,     v_brgy_dili,     340, 'packs',   '2024-11-17', 'demo-seed', 'received'),
      (v_art_relief, v_drinking_water,  v_brgy_guerrero, 220, 'cases',   '2024-11-15', 'demo-seed', 'received'),
      (v_art_relief, v_drinking_water,  v_brgy_bacnotan, 180, 'cases',   '2024-11-18', 'demo-seed', 'received'),
      (v_art_relief, v_hygiene,         v_brgy_dili,     120, 'kits',    '2024-11-19', 'demo-seed', 'received');

    -- --- EcoNest Sustainable Food Packaging (Bauang) — 7 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_econest, v_canned_food,     v_brgy_central_east, 420, 'packs',     '2024-11-12', 'demo-seed', 'received'),
      (v_econest, v_canned_food,     v_brgy_paringao,     380, 'packs',     '2024-11-14', 'demo-seed', 'received'),
      (v_econest, v_canned_food,     v_brgy_baccuit,      350, 'packs',     '2024-11-17', 'demo-seed', 'received'),
      (v_econest, v_hot_meals,       v_brgy_central_east, 310, 'meals',     '2024-11-15', 'demo-seed', 'received'),
      (v_econest, v_hot_meals,       v_brgy_paringao,     280, 'meals',     '2024-11-18', 'demo-seed', 'received'),
      (v_econest, v_hygiene,         v_brgy_baccuit,      160, 'kits',      '2024-11-19', 'demo-seed', 'received'),
      (v_econest, v_construction,    v_brgy_central_east, 120, 'sheets',    '2024-11-20', 'demo-seed', 'received');

    -- --- DOERS (Luna) — 6 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_doers, v_hot_meals,       v_brgy_nalvo,        460, 'meals',   '2024-11-13', 'demo-seed', 'received'),
      (v_doers, v_hot_meals,       v_brgy_poblacion_lu, 420, 'meals',   '2024-11-15', 'demo-seed', 'received'),
      (v_doers, v_canned_food,     v_brgy_nalvo,        350, 'packs',   '2024-11-16', 'demo-seed', 'received'),
      (v_doers, v_canned_food,     v_brgy_poblacion_lu, 280, 'packs',   '2024-11-18', 'demo-seed', 'received'),
      (v_doers, v_water_filt,      v_brgy_nalvo,         45, 'filters', '2024-11-19', 'demo-seed', 'received'),
      (v_doers, v_construction,    v_brgy_poblacion_lu, 150, 'sheets',  '2024-11-21', 'demo-seed', 'received');

    -- --- LU Citizen Volunteers (San Juan) — 5 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_lu_volunteers, v_hot_meals,    v_brgy_urbiztondo,   500, 'meals', '2024-11-11', 'demo-seed', 'received'),
      (v_lu_volunteers, v_hot_meals,    v_brgy_poblacion_sj, 480, 'meals', '2024-11-14', 'demo-seed', 'received'),
      (v_lu_volunteers, v_canned_food,  v_brgy_urbiztondo,   360, 'packs', '2024-11-16', 'demo-seed', 'received'),
      (v_lu_volunteers, v_canned_food,  v_brgy_poblacion_sj, 340, 'packs', '2024-11-18', 'demo-seed', 'received'),
      (v_lu_volunteers, v_hygiene,      v_brgy_urbiztondo,   120, 'kits',  '2024-11-20', 'demo-seed', 'received');

    -- --- La Union Surf Club (Bauang) — 5 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_lu_surf, v_construction,    v_brgy_baccuit,      250, 'sheets', '2024-11-12', 'demo-seed', 'received'),
      (v_lu_surf, v_construction,    v_brgy_paringao,     200, 'sheets', '2024-11-15', 'demo-seed', 'received'),
      (v_lu_surf, v_canned_food,     v_brgy_central_east, 320, 'packs',  '2024-11-17', 'demo-seed', 'received'),
      (v_lu_surf, v_canned_food,     v_brgy_baccuit,      280, 'packs',  '2024-11-19', 'demo-seed', 'received'),
      (v_lu_surf, v_hot_meals,       v_brgy_paringao,     260, 'meals',  '2024-11-20', 'demo-seed', 'received');

    -- --- Additional Waves4Water deployments (spread to new areas) ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_waves4water, v_water_filt,      v_brgy_bacnotan,     55, 'filters', '2024-11-13', 'demo-seed', 'received'),
      (v_waves4water, v_water_filt,      v_brgy_central_east, 48, 'filters', '2024-11-15', 'demo-seed', 'received'),
      (v_waves4water, v_water_filt,      v_brgy_nalvo,        42, 'filters', '2024-11-17', 'demo-seed', 'received'),
      (v_waves4water, v_drinking_water,  v_brgy_guerrero,    200, 'cases',   '2024-11-18', 'demo-seed', 'received'),
      (v_waves4water, v_drinking_water,  v_brgy_paringao,    180, 'cases',   '2024-11-20', 'demo-seed', 'received');

    -- --- Medical Supplies & Hygiene Kits (various orgs) ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, date, notes, status) VALUES
      (v_art_relief,    v_medical,  v_brgy_bacnotan,     185, 'kits', '2024-11-22', 'demo-seed', 'received'),
      (v_econest,       v_medical,  v_brgy_central_east, 160, 'kits', '2024-11-23', 'demo-seed', 'received'),
      (v_doers,         v_hygiene,  v_brgy_poblacion_lu, 140, 'kits', '2024-11-22', 'demo-seed', 'received'),
      (v_lu_volunteers, v_hygiene,  v_brgy_poblacion_sj, 130, 'kits', '2024-11-23', 'demo-seed', 'received'),
      (v_lu_surf,       v_medical,  v_brgy_baccuit,      120, 'kits', '2024-11-24', 'demo-seed', 'received');

  END IF;

  -- ============================================================
  -- 9. Insert demo needs — full lifecycle narrative
  --    Three threads trace needs from report to resolution;
  --    in_transit / completed / resolved rows link to deployments (§10).
  --    15 submissions: 3 pending, 4 verified, 3 in_transit, 3 completed, 2 resolved
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM submissions LIMIT 1) THEN

    -- ── Thread 1: Nalvo Flood (Luna, temporary shelter) ──────────────────
    --    Flash flood hit Nalvo Norte; three waves of need discovered.
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'resolved', 'Kap. Dante Soriano', v_brgy_nalvo, v_temp_shelter, 16.8088, 120.3688, 'foot_only', 30, 'critical',
              45, 30, 10,
              '30 homes destroyed by flash flood — tarps and lumber delivered by DOERS, families rebuilt',
              '2024-11-11 10:00:00+08', '2024-11-15 14:00:00+08', '2024-11-11 06:30:00+08')
      RETURNING id INTO v_sub_nalvo_resolved;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'completed', 'Ldr. Carmen Valdez', v_brgy_nalvo, v_temp_shelter, 16.8075, 120.3695, 'foot_only', 20, 'high',
              30, 18, 6,
              'Second wave — 20 families displaced upstream, DOERS delivered tarps and building materials',
              '2024-11-12 09:00:00+08', '2024-11-17 11:00:00+08', '2024-11-12 07:00:00+08')
      RETURNING id INTO v_sub_nalvo_completed;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, created_at)
      VALUES (v_event, 'in_transit', 'Vol. Rico Agustin', v_brgy_poblacion_lu, v_temp_shelter, 16.8012, 120.3728, 'cut_off', 15, 'high',
              22, 12, 4,
              'Additional families found further upstream — Art Relief sending construction materials',
              '2024-11-13 11:00:00+08', '2024-11-13 08:00:00+08')
      RETURNING id INTO v_sub_nalvo_intransit;

    -- ── Thread 2: Bauang Medical Emergency (Bauang, medical supplies) ─────
    --    Debris injuries across multiple Bauang barangays.
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'resolved', 'Kap. Elena Ramos', v_brgy_baccuit, v_medical, 16.5465, 120.3315, 'truck', 35, 'high',
              50, 20, 8,
              'Debris injuries across Baccuit Norte — La Union Surf Club delivered 120 medical kits, all treated',
              '2024-11-11 09:00:00+08', '2024-11-14 16:00:00+08', '2024-11-11 07:00:00+08')
      RETURNING id INTO v_sub_bauang_resolved;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'completed', 'Ldr. Paolo Cruz', v_brgy_central_east, v_medical, 16.5375, 120.3398, 'truck', 25, 'medium',
              35, 10, 5,
              'Minor injuries and infections in Central East — EcoNest delivered medical supplies',
              '2024-11-12 10:00:00+08', '2024-11-16 13:00:00+08', '2024-11-12 08:30:00+08')
      RETURNING id INTO v_sub_bauang_completed;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, created_at)
      VALUES (v_event, 'in_transit', 'Vol. Lisa Fernandez', v_brgy_paringao, v_medical, 16.5148, 120.3285, 'boat', 40, 'critical',
              60, 25, 12,
              'Flooding cut road to Paringao — boat-access only, LU Citizen Volunteers en route with medical kits',
              '2024-11-13 08:00:00+08', '2024-11-13 06:00:00+08')
      RETURNING id INTO v_sub_bauang_intransit;

    -- ── Thread 3: San Juan Food Shortage (San Juan, hot meals) ─
    --    Supplies running low across San Juan barangays.
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'completed', 'Kap. Maria Santos', v_brgy_poblacion_sj, v_hot_meals, 16.6638, 120.3292, 'truck', 70, 'high',
              100, 45, 15,
              'Poblacion families running out of food — LU Citizen Volunteers delivered 480 meals',
              '2024-11-11 08:00:00+08', '2024-11-14 10:00:00+08', '2024-11-11 06:00:00+08')
      RETURNING id INTO v_sub_sanjuan_completed;

    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, created_at)
      VALUES (v_event, 'in_transit', 'Ldr. Jose Reyes', v_brgy_urbiztondo, v_hot_meals, 16.6685, 120.3228, 'truck', 50, 'high',
              70, 30, 10,
              'Urbiztondo supplies critical — LU Citizen Volunteers sending relief goods',
              '2024-11-12 10:00:00+08', '2024-11-12 07:30:00+08')
      RETURNING id INTO v_sub_sanjuan_intransit;

    -- ── Verified needs awaiting donor response ──────────────────
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, verified_at, created_at) VALUES
      (v_event, 'verified', 'Vol. Rica Tan', v_brgy_urbiztondo, v_hot_meals, 16.6692, 120.3222, 'truck', 30, 'medium',
       40, 20, 5,
       'Second neighborhood in Urbiztondo reporting food shortage — families sharing remaining supplies',
       '2024-11-14 09:00:00+08', '2024-11-14 07:00:00+08'),
      (v_event, 'verified', 'Ldr. Teresa Aquino', v_brgy_poblacion_sj, v_canned_food, 16.6632, 120.3298, 'truck', 20, 'medium',
       25, 5, 12,
       'Elderly residents in Poblacion need special dietary provisions — regular relief goods insufficient',
       '2024-11-14 11:00:00+08', '2024-11-14 08:00:00+08'),
      (v_event, 'verified', 'Vol. Marco Diaz', v_brgy_paringao, v_medical, 16.5155, 120.3278, 'boat', 15, 'high',
       20, 8, 3,
       'Additional injuries discovered in Paringao — need more first aid supplies beyond initial delivery',
       '2024-11-15 10:00:00+08', '2024-11-15 08:00:00+08'),
      (v_event, 'verified', 'Kap. Luis Aquino', v_brgy_bacnotan, v_temp_shelter, 16.7340, 120.3480, '4x4', 25, 'high',
       35, 20, 8,
       'Road partially blocked by landslide — 25 families need roofing materials, 4x4 can reach',
       '2024-11-15 14:00:00+08', '2024-11-15 11:00:00+08');

    -- ── Pending (unverified reports awaiting triage) ────────────
    INSERT INTO submissions (event_id, status, contact_name, barangay_id, aid_category_id, lat, lng, access_status, quantity_needed, urgency, num_adults, num_children, num_seniors_pwd, notes, created_at) VALUES
      (v_event, 'pending', 'Caller: unknown', v_brgy_dili, v_canned_food, 16.7418, 120.3518, '4x4', 45, 'critical',
       0, 0, 0,
       'Unverified phone report — community behind collapsed bridge, food running out',
       '2024-11-16 06:00:00+08'),
      (v_event, 'pending', 'Caller: Juan dela Cruz', v_brgy_guerrero, v_medical, 16.7255, 120.3545, 'truck', 20, 'medium',
       0, 0, 0,
       'Walk-in report at relief center — says neighbors have untreated cuts, needs verification',
       '2024-11-16 09:00:00+08'),
      (v_event, 'pending', 'SMS: +63 9XX XXX XXXX', v_brgy_poblacion_lu, v_temp_shelter, 16.8008, 120.3732, 'cut_off', NULL, 'critical',
       0, 0, 0,
       'SMS received — sender says multiple houses collapsed, area cut off, quantity unknown',
       '2024-11-16 11:00:00+08');

  END IF;

  -- ============================================================
  -- 10. Insert linked deployments (fulfill specific needs)
  --     These deployments reference submissions via submission_id,
  --     showing the full matchmaker workflow (issue #63).
  --     Tagged 'demo-seed-linked' for independent teardown.
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM deployments WHERE notes = 'demo-seed-linked' LIMIT 1) THEN

    -- Thread 1: DOERS responded to Nalvo shelter crisis
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_doers, v_construction, v_brgy_nalvo, v_sub_nalvo_resolved,  200, 'sheets', '2024-11-13', 'demo-seed-linked', 'received'),
      (v_event, v_doers, v_construction, v_brgy_nalvo, v_sub_nalvo_completed, 150, 'sheets', '2024-11-15', 'demo-seed-linked', 'received');

    -- Thread 1: Art Relief sending materials to upstream families
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_art_relief, v_construction, v_brgy_poblacion_lu, v_sub_nalvo_intransit, 100, 'sheets', '2024-11-16', 'demo-seed-linked', 'pending');

    -- Thread 2: La Union Surf Club responded to Baccuit medical need
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_lu_surf, v_medical, v_brgy_baccuit, v_sub_bauang_resolved, 120, 'kits', '2024-11-12', 'demo-seed-linked', 'received');

    -- Thread 2: EcoNest responded to Central East medical need
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_econest, v_medical, v_brgy_central_east, v_sub_bauang_completed, 160, 'kits', '2024-11-14', 'demo-seed-linked', 'received');

    -- Thread 2: LU Citizen Volunteers en route to Paringao with medical kits
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_lu_volunteers, v_medical, v_brgy_paringao, v_sub_bauang_intransit, 80, 'kits', '2024-11-16', 'demo-seed-linked', 'pending');

    -- Thread 3: LU Citizen Volunteers delivered meals to Poblacion SJ
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_lu_volunteers, v_hot_meals, v_brgy_poblacion_sj, v_sub_sanjuan_completed, 480, 'meals', '2024-11-13', 'demo-seed-linked', 'received');

    -- Thread 3: LU Citizen Volunteers sending canned food to Urbiztondo
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, date, notes, status) VALUES
      (v_event, v_lu_volunteers, v_canned_food, v_brgy_urbiztondo, v_sub_sanjuan_intransit, 350, 'packs', '2024-11-15', 'demo-seed-linked', 'pending');

  END IF;

  -- ============================================================
  -- 11. Purchases (goods bought with donations)
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM purchases WHERE notes = 'demo-seed' LIMIT 1) THEN
    INSERT INTO purchases (event_id, organization_id, aid_category_id, quantity, unit, cost, date, notes) VALUES
      (v_event, v_sjrrhass,   v_hot_meals,       500, 'meals',   25000.00,  '2024-12-08', 'demo-seed'),
      (v_event, v_feed_inc,   v_drinking_water, 1000, 'bottles', 15000.00,  '2024-12-09', 'demo-seed'),
      (v_event, v_econest,    v_hygiene,          200, 'kits',    40000.00,  '2024-12-10', 'demo-seed'),
      (v_event, v_starlight,  v_medical,          150, 'packs',   75000.00,  '2024-12-11', 'demo-seed'),
      (v_event, v_citizens,   v_canned_food,      300, 'cases',   18000.00,  '2024-12-12', 'demo-seed'),
      (v_event, v_emerging,   v_construction,     100, 'bundles', 50000.00,  '2024-12-13', 'demo-seed'),
      (v_event, v_curma,      v_clothing,         400, 'sets',    32000.00,  '2024-12-14', 'demo-seed'),
      (v_event, v_waves4water, v_water_filt,       50, 'units',  125000.00,  '2024-12-15', 'demo-seed');
  END IF;

  -- Link existing deployments to the event
  UPDATE deployments SET event_id = v_event WHERE notes IN ('demo-seed', 'demo-seed-linked');

  -- ============================================================
  -- 12. Add coordinates to hub organizations (for Relief Map hub markers)
  -- ============================================================
  UPDATE organizations SET lat = 16.6159, lng = 120.3209 WHERE name = 'SJRRHASS' AND lat IS NULL;
  UPDATE organizations SET lat = 16.6833, lng = 120.3667 WHERE name = 'Citizens for LU' AND lat IS NULL;
  UPDATE organizations SET lat = 16.5500, lng = 120.3833 WHERE name = 'EcoNest Sustainable Food Packaging' AND lat IS NULL;
  UPDATE organizations SET lat = 16.6920, lng = 120.3480 WHERE name = 'Art Relief Mobile Kitchen' AND lat IS NULL;
  UPDATE organizations SET lat = 16.6681, lng = 120.3225 WHERE name = 'Surftown Pride' AND lat IS NULL;

  -- ============================================================
  -- 13. Insert demo hazards (idempotent via WHERE NOT EXISTS)
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM hazards WHERE event_id = v_event LIMIT 1) THEN
    INSERT INTO hazards (event_id, hazard_type, description, latitude, longitude, status) VALUES
      (v_event, 'flood', 'Flooded road near barangay center, waist-deep', 16.63, 120.34, 'active'),
      (v_event, 'road_blocked', 'Fallen tree blocking main road to Bacnotan', 16.69, 120.35, 'active'),
      (v_event, 'electrical_hazard', 'Downed power lines near school', 16.61, 120.32, 'active');
  END IF;

  RAISE NOTICE 'Demo seed complete!';
END $$;
