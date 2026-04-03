-- seed-demo.sql — Demo data for LUaid dashboard prototype
-- Populates donations, volunteer counts, geographic diversity, and barangays.
-- Run in the Supabase SQL Editor AFTER running schema.sql.
--
-- Safe to run multiple times: uses WHERE NOT EXISTS guards and ON CONFLICT.
-- To undo: DELETE FROM deployments WHERE notes IN ('demo-seed', 'demo-seed-linked');
--          DELETE FROM donations WHERE notes = 'demo-seed';
--          DELETE FROM submissions WHERE type = 'need';
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

  -- Aid category IDs
  v_meals            uuid;
  v_relief           uuid;
  v_water_filt       uuid;
  v_construction     uuid;
  v_cleaning         uuid;
  v_drinking         uuid;
  v_kiddie           uuid;
  v_medical          uuid;
  v_emergency        uuid;

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
  INSERT INTO organizations (name, type, municipality)
    SELECT 'Citizens for LU', 'both', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Citizens for LU');
  SELECT id INTO v_citizens FROM organizations WHERE name = 'Citizens for LU';

  INSERT INTO organizations (name, type, municipality)
    SELECT 'Emerging Islands', 'hub', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Emerging Islands');
  SELECT id INTO v_emerging FROM organizations WHERE name = 'Emerging Islands';

  INSERT INTO organizations (name, type, municipality)
    SELECT 'CURMA', 'hub', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'CURMA');
  SELECT id INTO v_curma FROM organizations WHERE name = 'CURMA';

  INSERT INTO organizations (name, type, municipality)
    SELECT 'Waves4Water', 'hub', 'San Juan'
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
  -- 2. Look up existing aid categories
  -- ============================================================
  SELECT id INTO v_meals        FROM aid_categories WHERE name = 'Meals';
  SELECT id INTO v_relief       FROM aid_categories WHERE name = 'Relief Goods';
  SELECT id INTO v_water_filt   FROM aid_categories WHERE name = 'Water Filtration';
  SELECT id INTO v_construction FROM aid_categories WHERE name = 'Construction Materials';
  SELECT id INTO v_cleaning     FROM aid_categories WHERE name = 'Cleaning Supplies';
  SELECT id INTO v_drinking     FROM aid_categories WHERE name = 'Drinking Water';
  SELECT id INTO v_kiddie       FROM aid_categories WHERE name = 'Kiddie Packs';

  -- ============================================================
  -- 3. Insert new aid categories (idempotent via UNIQUE name)
  -- ============================================================
  INSERT INTO aid_categories (name, icon) VALUES ('Medical Supplies', 'heart-pulse')
    ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_medical FROM aid_categories WHERE name = 'Medical Supplies';

  INSERT INTO aid_categories (name, icon) VALUES ('Emergency Kits', 'siren')
    ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_emergency FROM aid_categories WHERE name = 'Emergency Kits';

  -- ============================================================
  -- 4. Insert new organizations (idempotent via WHERE NOT EXISTS)
  -- ============================================================
  -- Donor organizations
  INSERT INTO organizations (name, type, municipality)
    SELECT 'SJRRHASS', 'donor', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'SJRRHASS');
  SELECT id INTO v_sjrrhass FROM organizations WHERE name = 'SJRRHASS';

  INSERT INTO organizations (name, type, municipality)
    SELECT 'Surftown Pride', 'donor', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Surftown Pride');
  SELECT id INTO v_surftown FROM organizations WHERE name = 'Surftown Pride';

  INSERT INTO organizations (name, type, municipality)
    SELECT 'FEED Inc', 'donor', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'FEED Inc');
  SELECT id INTO v_feed_inc FROM organizations WHERE name = 'FEED Inc';

  INSERT INTO organizations (name, type, municipality)
    SELECT 'Starlight Raniag Tin San Juan', 'donor', 'San Juan'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Starlight Raniag Tin San Juan');
  SELECT id INTO v_starlight FROM organizations WHERE name = 'Starlight Raniag Tin San Juan';

  INSERT INTO organizations (name, type, municipality)
    SELECT 'Greenpeace Philippines', 'donor', 'Manila'
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Greenpeace Philippines');
  SELECT id INTO v_greenpeace FROM organizations WHERE name = 'Greenpeace Philippines';

  -- Hub organizations
  INSERT INTO organizations (name, type, municipality, lat, lng)
    SELECT 'Art Relief Mobile Kitchen', 'hub', 'Bacnotan', 16.7332, 120.3489
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Art Relief Mobile Kitchen');
  SELECT id INTO v_art_relief FROM organizations WHERE name = 'Art Relief Mobile Kitchen';

  INSERT INTO organizations (name, type, municipality, lat, lng)
    SELECT 'EcoNest Sustainable Food Packaging', 'hub', 'Bauang', 16.5370, 120.3395
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'EcoNest Sustainable Food Packaging');
  SELECT id INTO v_econest FROM organizations WHERE name = 'EcoNest Sustainable Food Packaging';

  INSERT INTO organizations (name, type, municipality, lat, lng)
    SELECT 'DOERS', 'hub', 'Luna', 16.8008, 120.3729
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'DOERS');
  SELECT id INTO v_doers FROM organizations WHERE name = 'DOERS';

  INSERT INTO organizations (name, type, municipality, lat, lng)
    SELECT 'LU Citizen Volunteers', 'hub', 'San Juan', 16.6636, 120.3287
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'LU Citizen Volunteers');
  SELECT id INTO v_lu_volunteers FROM organizations WHERE name = 'LU Citizen Volunteers';

  INSERT INTO organizations (name, type, municipality, lat, lng)
    SELECT 'La Union Surf Club', 'hub', 'Bauang', 16.5460, 120.3310
    WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'La Union Surf Club');
  SELECT id INTO v_lu_surf FROM organizations WHERE name = 'La Union Surf Club';

  -- Update existing orgs to 'both' (they now have donations too)
  UPDATE organizations SET type = 'both' WHERE id IN (v_emerging, v_curma);

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
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_art_relief, v_meals,    v_brgy_bacnotan, 520, 'meals',  16.7345, 120.3475, '2024-11-11', 8, 6.0, 'demo-seed'),
      (v_art_relief, v_meals,    v_brgy_dili,     480, 'meals',  16.7400, 120.3530, '2024-11-13', 7, 5.5, 'demo-seed'),
      (v_art_relief, v_meals,    v_brgy_guerrero, 450, 'meals',  16.7260, 120.3550, '2024-11-16', 6, 5.0, 'demo-seed'),
      (v_art_relief, v_relief,   v_brgy_bacnotan, 380, 'packs',  16.7340, 120.3500, '2024-11-14', 5, 4.0, 'demo-seed'),
      (v_art_relief, v_relief,   v_brgy_dili,     340, 'packs',  16.7420, 120.3510, '2024-11-17', 4, 3.5, 'demo-seed'),
      (v_art_relief, v_drinking, v_brgy_guerrero, 220, 'cases',  16.7255, 120.3535, '2024-11-15', 3, 2.0, 'demo-seed'),
      (v_art_relief, v_drinking, v_brgy_bacnotan, 180, 'cases',  16.7330, 120.3495, '2024-11-18', 3, 2.0, 'demo-seed'),
      (v_art_relief, v_kiddie,   v_brgy_dili,     120, 'packs',  16.7415, 120.3525, '2024-11-19', 2, 1.5, 'demo-seed');

    -- --- EcoNest Sustainable Food Packaging (Bauang) — 7 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_econest, v_relief,       v_brgy_central_east, 420, 'packs',     16.5380, 120.3400, '2024-11-12', 6, 4.5, 'demo-seed'),
      (v_econest, v_relief,       v_brgy_paringao,     380, 'packs',     16.5150, 120.3290, '2024-11-14', 5, 4.0, 'demo-seed'),
      (v_econest, v_relief,       v_brgy_baccuit,      350, 'packs',     16.5465, 120.3320, '2024-11-17', 5, 3.5, 'demo-seed'),
      (v_econest, v_meals,        v_brgy_central_east, 310, 'meals',     16.5375, 120.3390, '2024-11-15', 4, 3.0, 'demo-seed'),
      (v_econest, v_meals,        v_brgy_paringao,     280, 'meals',     16.5145, 120.3275, '2024-11-18', 4, 3.0, 'demo-seed'),
      (v_econest, v_cleaning,     v_brgy_baccuit,      160, 'kits',      16.5455, 120.3305, '2024-11-19', 3, 2.0, 'demo-seed'),
      (v_econest, v_construction, v_brgy_central_east, 120, 'sheets',    16.5360, 120.3410, '2024-11-20', 3, 2.5, 'demo-seed');

    -- --- DOERS (Luna) — 6 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_doers, v_meals,        v_brgy_nalvo,        460, 'meals',   16.8090, 120.3690, '2024-11-13', 7, 5.0, 'demo-seed'),
      (v_doers, v_meals,        v_brgy_poblacion_lu, 420, 'meals',   16.8015, 120.3735, '2024-11-15', 6, 4.5, 'demo-seed'),
      (v_doers, v_relief,       v_brgy_nalvo,        350, 'packs',   16.8085, 120.3675, '2024-11-16', 5, 3.5, 'demo-seed'),
      (v_doers, v_relief,       v_brgy_poblacion_lu, 280, 'packs',   16.8010, 120.3720, '2024-11-18', 4, 3.0, 'demo-seed'),
      (v_doers, v_water_filt,   v_brgy_nalvo,         45, 'filters', 16.8075, 120.3685, '2024-11-19', 3, 2.0, 'demo-seed'),
      (v_doers, v_construction, v_brgy_poblacion_lu,  150, 'sheets',  16.8005, 120.3740, '2024-11-21', 4, 3.0, 'demo-seed');

    -- --- LU Citizen Volunteers (San Juan) — 5 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_lu_volunteers, v_meals,    v_brgy_urbiztondo,   500, 'meals', 16.6690, 120.3230, '2024-11-11', 8, 6.0, 'demo-seed'),
      (v_lu_volunteers, v_meals,    v_brgy_poblacion_sj, 480, 'meals', 16.6640, 120.3290, '2024-11-14', 7, 5.5, 'demo-seed'),
      (v_lu_volunteers, v_relief,   v_brgy_urbiztondo,   360, 'packs', 16.6685, 120.3220, '2024-11-16', 5, 4.0, 'demo-seed'),
      (v_lu_volunteers, v_relief,   v_brgy_poblacion_sj, 340, 'packs', 16.6630, 120.3295, '2024-11-18', 5, 3.5, 'demo-seed'),
      (v_lu_volunteers, v_kiddie,   v_brgy_urbiztondo,   120, 'packs', 16.6675, 120.3235, '2024-11-20', 3, 2.0, 'demo-seed');

    -- --- La Union Surf Club (Bauang) — 5 deployments ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_lu_surf, v_construction, v_brgy_baccuit,      250, 'sheets', 16.5470, 120.3315, '2024-11-12', 6, 5.0, 'demo-seed'),
      (v_lu_surf, v_construction, v_brgy_paringao,     200, 'sheets', 16.5135, 120.3285, '2024-11-15', 5, 4.5, 'demo-seed'),
      (v_lu_surf, v_relief,       v_brgy_central_east, 320, 'packs',  16.5365, 120.3405, '2024-11-17', 4, 3.0, 'demo-seed'),
      (v_lu_surf, v_relief,       v_brgy_baccuit,      280, 'packs',  16.5458, 120.3318, '2024-11-19', 4, 3.0, 'demo-seed'),
      (v_lu_surf, v_meals,        v_brgy_paringao,     260, 'meals',  16.5142, 120.3278, '2024-11-20', 3, 2.5, 'demo-seed');

    -- --- Additional Waves4Water deployments (spread to new areas) ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_waves4water, v_water_filt, v_brgy_bacnotan,    55, 'filters', 16.7338, 120.3492, '2024-11-13', 4, 3.0, 'demo-seed'),
      (v_waves4water, v_water_filt, v_brgy_central_east, 48, 'filters', 16.5372, 120.3398, '2024-11-15', 3, 2.5, 'demo-seed'),
      (v_waves4water, v_water_filt, v_brgy_nalvo,        42, 'filters', 16.8082, 120.3678, '2024-11-17', 3, 2.0, 'demo-seed'),
      (v_waves4water, v_drinking,  v_brgy_guerrero,    200, 'cases',   16.7248, 120.3538, '2024-11-18', 3, 2.0, 'demo-seed'),
      (v_waves4water, v_drinking,  v_brgy_paringao,    180, 'cases',   16.5138, 120.3282, '2024-11-20', 2, 1.5, 'demo-seed');

    -- --- Medical Supplies & Emergency Kits (various orgs) ---
    INSERT INTO deployments (organization_id, aid_category_id, barangay_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_art_relief,    v_medical,   v_brgy_bacnotan,     185, 'kits',  16.7335, 120.3485, '2024-11-22', 3, 2.0, 'demo-seed'),
      (v_econest,       v_medical,   v_brgy_central_east, 160, 'kits',  16.5368, 120.3392, '2024-11-23', 3, 2.0, 'demo-seed'),
      (v_doers,         v_emergency, v_brgy_poblacion_lu, 140, 'kits',  16.8012, 120.3732, '2024-11-22', 4, 2.5, 'demo-seed'),
      (v_lu_volunteers, v_emergency, v_brgy_poblacion_sj, 130, 'kits',  16.6638, 120.3292, '2024-11-23', 3, 2.0, 'demo-seed'),
      (v_lu_surf,       v_medical,   v_brgy_baccuit,      120, 'kits',  16.5462, 120.3312, '2024-11-24', 2, 1.5, 'demo-seed');

  END IF;

  -- ============================================================
  -- 8. Add volunteer_count to existing deployments
  --    Distribute ~70 volunteers across existing San Juan rows
  -- ============================================================
  UPDATE deployments
    SET volunteer_count = CASE
      WHEN quantity >= 200 THEN 6
      WHEN quantity >= 100 THEN 4
      WHEN quantity >= 50  THEN 3
      WHEN quantity >= 10  THEN 2
      ELSE 1
    END
  WHERE volunteer_count IS NULL
    AND notes IS DISTINCT FROM 'demo-seed';

  -- ============================================================
  -- 9. Insert demo needs — full lifecycle narrative
  --    Three threads trace needs from report to resolution;
  --    in_transit / completed / resolved rows link to deployments (§10).
  --    15 submissions: 3 pending, 4 verified, 3 in_transit, 3 completed, 2 resolved
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM submissions WHERE type = 'need' LIMIT 1) THEN

    -- ── Thread 1: Nalvo Flood (Luna, shelter) ──────────────────
    --    Flash flood hit Nalvo Norte; three waves of need discovered.
    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'need', 'resolved', 'Kap. Dante Soriano', v_brgy_nalvo, 'shelter', 16.8088, 120.3688, 'foot_only', 30, 'critical',
              '30 homes destroyed by flash flood — tarps and lumber delivered by DOERS, families rebuilt',
              '2024-11-11 10:00:00+08', '2024-11-15 14:00:00+08', '2024-11-11 06:30:00+08')
      RETURNING id INTO v_sub_nalvo_resolved;

    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'need', 'completed', 'Ldr. Carmen Valdez', v_brgy_nalvo, 'shelter', 16.8075, 120.3695, 'foot_only', 20, 'high',
              'Second wave — 20 families displaced upstream, DOERS delivered tarps and building materials',
              '2024-11-12 09:00:00+08', '2024-11-17 11:00:00+08', '2024-11-12 07:00:00+08')
      RETURNING id INTO v_sub_nalvo_completed;

    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, created_at)
      VALUES (v_event, 'need', 'in_transit', 'Vol. Rico Agustin', v_brgy_poblacion_lu, 'shelter', 16.8012, 120.3728, 'cut_off', 15, 'high',
              'Additional families found further upstream — Art Relief sending construction materials',
              '2024-11-13 11:00:00+08', '2024-11-13 08:00:00+08')
      RETURNING id INTO v_sub_nalvo_intransit;

    -- ── Thread 2: Bauang Medical Emergency (Bauang, lunas) ─────
    --    Debris injuries across multiple Bauang barangays.
    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'need', 'resolved', 'Kap. Elena Ramos', v_brgy_baccuit, 'lunas', 16.5465, 120.3315, 'truck', 35, 'high',
              'Debris injuries across Baccuit Norte — La Union Surf Club delivered 120 medical kits, all treated',
              '2024-11-11 09:00:00+08', '2024-11-14 16:00:00+08', '2024-11-11 07:00:00+08')
      RETURNING id INTO v_sub_bauang_resolved;

    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'need', 'completed', 'Ldr. Paolo Cruz', v_brgy_central_east, 'lunas', 16.5375, 120.3398, 'truck', 25, 'medium',
              'Minor injuries and infections in Central East — EcoNest delivered medical supplies',
              '2024-11-12 10:00:00+08', '2024-11-16 13:00:00+08', '2024-11-12 08:30:00+08')
      RETURNING id INTO v_sub_bauang_completed;

    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, created_at)
      VALUES (v_event, 'need', 'in_transit', 'Vol. Lisa Fernandez', v_brgy_paringao, 'lunas', 16.5148, 120.3285, 'boat', 40, 'critical',
              'Flooding cut road to Paringao — boat-access only, LU Citizen Volunteers en route with emergency kits',
              '2024-11-13 08:00:00+08', '2024-11-13 06:00:00+08')
      RETURNING id INTO v_sub_bauang_intransit;

    -- ── Thread 3: San Juan Food Shortage (San Juan, sustenance) ─
    --    Supplies running low across San Juan barangays.
    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, completed_at, created_at)
      VALUES (v_event, 'need', 'completed', 'Kap. Maria Santos', v_brgy_poblacion_sj, 'sustenance', 16.6638, 120.3292, 'truck', 70, 'high',
              'Poblacion families running out of food — LU Citizen Volunteers delivered 480 meals',
              '2024-11-11 08:00:00+08', '2024-11-14 10:00:00+08', '2024-11-11 06:00:00+08')
      RETURNING id INTO v_sub_sanjuan_completed;

    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, created_at)
      VALUES (v_event, 'need', 'in_transit', 'Ldr. Jose Reyes', v_brgy_urbiztondo, 'sustenance', 16.6685, 120.3228, 'truck', 50, 'high',
              'Urbiztondo supplies critical — LU Citizen Volunteers sending relief goods',
              '2024-11-12 10:00:00+08', '2024-11-12 07:30:00+08')
      RETURNING id INTO v_sub_sanjuan_intransit;

    -- ── Verified needs awaiting donor response ──────────────────
    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, verified_at, created_at) VALUES
      (v_event, 'need', 'verified', 'Vol. Rica Tan', v_brgy_urbiztondo, 'sustenance', 16.6692, 120.3222, 'truck', 30, 'medium',
       'Second neighborhood in Urbiztondo reporting food shortage — families sharing remaining supplies',
       '2024-11-14 09:00:00+08', '2024-11-14 07:00:00+08'),
      (v_event, 'need', 'verified', 'Ldr. Teresa Aquino', v_brgy_poblacion_sj, 'sustenance', 16.6632, 120.3298, 'truck', 20, 'medium',
       'Elderly residents in Poblacion need special dietary provisions — regular relief goods insufficient',
       '2024-11-14 11:00:00+08', '2024-11-14 08:00:00+08'),
      (v_event, 'need', 'verified', 'Vol. Marco Diaz', v_brgy_paringao, 'lunas', 16.5155, 120.3278, 'boat', 15, 'high',
       'Additional injuries discovered in Paringao — need more first aid supplies beyond initial delivery',
       '2024-11-15 10:00:00+08', '2024-11-15 08:00:00+08'),
      (v_event, 'need', 'verified', 'Kap. Luis Aquino', v_brgy_bacnotan, 'shelter', 16.7340, 120.3480, '4x4', 25, 'high',
       'Road partially blocked by landslide — 25 families need roofing materials, 4x4 can reach',
       '2024-11-15 14:00:00+08', '2024-11-15 11:00:00+08');

    -- ── Pending (unverified reports awaiting triage) ────────────
    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, created_at) VALUES
      (v_event, 'need', 'pending', 'Caller: unknown', v_brgy_dili, 'sustenance', 16.7418, 120.3518, '4x4', 45, 'critical',
       'Unverified phone report — community behind collapsed bridge, food running out',
       '2024-11-16 06:00:00+08'),
      (v_event, 'need', 'pending', 'Caller: Juan dela Cruz', v_brgy_guerrero, 'lunas', 16.7255, 120.3545, 'truck', 20, 'medium',
       'Walk-in report at relief center — says neighbors have untreated cuts, needs verification',
       '2024-11-16 09:00:00+08'),
      (v_event, 'need', 'pending', 'SMS: +63 9XX XXX XXXX', v_brgy_poblacion_lu, 'shelter', 16.8008, 120.3732, 'cut_off', NULL, 'critical',
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
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_event, v_doers, v_construction, v_brgy_nalvo, v_sub_nalvo_resolved,  200, 'sheets', 16.8090, 120.3690, '2024-11-13', 6, 5.0, 'demo-seed-linked'),
      (v_event, v_doers, v_construction, v_brgy_nalvo, v_sub_nalvo_completed, 150, 'sheets', 16.8078, 120.3698, '2024-11-15', 5, 4.0, 'demo-seed-linked');

    -- Thread 1: Art Relief sending materials to upstream families
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_event, v_art_relief, v_construction, v_brgy_poblacion_lu, v_sub_nalvo_intransit, 100, 'sheets', 16.8015, 120.3730, '2024-11-16', 4, 3.0, 'demo-seed-linked');

    -- Thread 2: La Union Surf Club responded to Baccuit medical need
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_event, v_lu_surf, v_medical, v_brgy_baccuit, v_sub_bauang_resolved, 120, 'kits', 16.5468, 120.3318, '2024-11-12', 3, 2.0, 'demo-seed-linked');

    -- Thread 2: EcoNest responded to Central East medical need
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_event, v_econest, v_medical, v_brgy_central_east, v_sub_bauang_completed, 160, 'kits', 16.5378, 120.3395, '2024-11-14', 3, 2.0, 'demo-seed-linked');

    -- Thread 2: LU Citizen Volunteers en route to Paringao with emergency kits
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_event, v_lu_volunteers, v_emergency, v_brgy_paringao, v_sub_bauang_intransit, 80, 'kits', 16.5145, 120.3282, '2024-11-16', 4, 3.0, 'demo-seed-linked');

    -- Thread 3: LU Citizen Volunteers delivered meals to Poblacion SJ
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_event, v_lu_volunteers, v_meals, v_brgy_poblacion_sj, v_sub_sanjuan_completed, 480, 'meals', 16.6642, 120.3288, '2024-11-13', 7, 5.5, 'demo-seed-linked');

    -- Thread 3: LU Citizen Volunteers sending relief goods to Urbiztondo
    INSERT INTO deployments (event_id, organization_id, aid_category_id, barangay_id, submission_id, quantity, unit, lat, lng, date, volunteer_count, hours, notes) VALUES
      (v_event, v_lu_volunteers, v_relief, v_brgy_urbiztondo, v_sub_sanjuan_intransit, 350, 'packs', 16.6688, 120.3225, '2024-11-15', 5, 4.0, 'demo-seed-linked');

  END IF;

  -- Link existing deployments to the event
  UPDATE deployments SET event_id = v_event WHERE notes IN ('demo-seed', 'demo-seed-linked');

  RAISE NOTICE 'Demo seed complete!';
END $$;
