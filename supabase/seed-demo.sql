-- seed-demo.sql — Demo data for LUaid dashboard prototype
-- Populates donations, volunteer counts, geographic diversity, and barangays.
-- Run in the Supabase SQL Editor.
--
-- Safe to run multiple times: uses ON CONFLICT or checks for existing data.
-- To undo: DELETE FROM deployments WHERE notes = 'demo-seed';
--          DELETE FROM donations WHERE notes = 'demo-seed';
--          DELETE FROM barangays WHERE name IN (...);
--          DELETE FROM organizations WHERE name IN (...);

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

  -- Gap category IDs
  v_lunas          uuid;
  v_sustenance     uuid;
  v_shelter        uuid;

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

BEGIN
  -- ============================================================
  -- 1. Look up existing organizations
  -- ============================================================
  SELECT id INTO v_citizens   FROM organizations WHERE name = 'Citizens for LU';
  SELECT id INTO v_emerging   FROM organizations WHERE name = 'Emerging Islands';
  SELECT id INTO v_curma      FROM organizations WHERE name = 'CURMA';
  SELECT id INTO v_waves4water FROM organizations WHERE name = 'Waves4Water';

  -- ============================================================
  -- 0. Insert demo event
  -- ============================================================
  INSERT INTO events (name, slug, description, region, started_at, is_active)
    VALUES (
      'Typhoon Emong Relief',
      'typhoon-emong-2024',
      'Category 4 typhoon making landfall in La Union, November 2024',
      'La Union',
      '2024-11-10',
      true
    )
    RETURNING id INTO v_event;

  -- Look up scope gap categories
  SELECT id INTO v_lunas      FROM aid_categories WHERE name = 'Lunas';
  SELECT id INTO v_sustenance FROM aid_categories WHERE name = 'Sustenance';
  SELECT id INTO v_shelter    FROM aid_categories WHERE name = 'Shelter';

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
  -- 3. Insert new aid categories
  -- ============================================================
  INSERT INTO aid_categories (name, icon) VALUES ('Medical Supplies', 'heart-pulse')
    ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_medical FROM aid_categories WHERE name = 'Medical Supplies';

  INSERT INTO aid_categories (name, icon) VALUES ('Emergency Kits', 'siren')
    ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_emergency FROM aid_categories WHERE name = 'Emergency Kits';

  -- ============================================================
  -- 4. Insert new organizations
  -- ============================================================
  -- Donor organizations
  INSERT INTO organizations (name, type, municipality)
    VALUES ('SJRRHASS', 'donor', 'San Juan')
    RETURNING id INTO v_sjrrhass;

  INSERT INTO organizations (name, type, municipality)
    VALUES ('Surftown Pride', 'donor', 'San Juan')
    RETURNING id INTO v_surftown;

  INSERT INTO organizations (name, type, municipality)
    VALUES ('FEED Inc', 'donor', 'San Juan')
    RETURNING id INTO v_feed_inc;

  INSERT INTO organizations (name, type, municipality)
    VALUES ('Starlight Raniag Tin San Juan', 'donor', 'San Juan')
    RETURNING id INTO v_starlight;

  INSERT INTO organizations (name, type, municipality)
    VALUES ('Greenpeace Philippines', 'donor', 'Manila')
    RETURNING id INTO v_greenpeace;

  -- Hub organizations (new municipalities)
  INSERT INTO organizations (name, type, municipality, lat, lng)
    VALUES ('Art Relief Mobile Kitchen', 'hub', 'Bacnotan', 16.7332, 120.3489)
    RETURNING id INTO v_art_relief;

  INSERT INTO organizations (name, type, municipality, lat, lng)
    VALUES ('EcoNest Sustainable Food Packaging', 'hub', 'Bauang', 16.5370, 120.3395)
    RETURNING id INTO v_econest;

  INSERT INTO organizations (name, type, municipality, lat, lng)
    VALUES ('DOERS', 'hub', 'Luna', 16.8008, 120.3729)
    RETURNING id INTO v_doers;

  INSERT INTO organizations (name, type, municipality, lat, lng)
    VALUES ('LU Citizen Volunteers', 'hub', 'San Juan', 16.6636, 120.3287)
    RETURNING id INTO v_lu_volunteers;

  INSERT INTO organizations (name, type, municipality, lat, lng)
    VALUES ('La Union Surf Club', 'hub', 'Bauang', 16.5460, 120.3310)
    RETURNING id INTO v_lu_surf;

  -- Update existing orgs to 'both' (they now have donations too)
  UPDATE organizations SET type = 'both' WHERE id IN (v_emerging, v_curma);

  -- ============================================================
  -- 5. Insert barangays
  -- ============================================================
  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Urbiztondo', 'San Juan', 16.6681, 120.3225, 4200)
    RETURNING id INTO v_brgy_urbiztondo;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Poblacion', 'San Juan', 16.6636, 120.3287, 3800)
    RETURNING id INTO v_brgy_poblacion_sj;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Bacnotan Proper', 'Bacnotan', 16.7332, 120.3489, 5100)
    RETURNING id INTO v_brgy_bacnotan;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Dili', 'Bacnotan', 16.7412, 120.3520, 2900)
    RETURNING id INTO v_brgy_dili;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Central East', 'Bauang', 16.5370, 120.3395, 3400)
    RETURNING id INTO v_brgy_central_east;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Paringao', 'Bauang', 16.5140, 120.3280, 2800)
    RETURNING id INTO v_brgy_paringao;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Nalvo Norte', 'Luna', 16.8080, 120.3680, 2100)
    RETURNING id INTO v_brgy_nalvo;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Poblacion', 'Luna', 16.8008, 120.3729, 3200)
    RETURNING id INTO v_brgy_poblacion_lu;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Guerrero', 'Bacnotan', 16.7250, 120.3540, 2400)
    RETURNING id INTO v_brgy_guerrero;

  INSERT INTO barangays (name, municipality, lat, lng, population)
    VALUES ('Baccuit Norte', 'Bauang', 16.5460, 120.3310, 3100)
    RETURNING id INTO v_brgy_baccuit;

  -- ============================================================
  -- 6. Insert donations (total ≈ ₱2,847,500)
  -- ============================================================
  INSERT INTO donations (organization_id, amount, date, notes) VALUES
    (v_sjrrhass,   720000.00, '2024-11-10', 'demo-seed'),
    (v_citizens,   510000.00, '2024-11-12', 'demo-seed'),
    (v_emerging,   400000.00, '2024-11-14', 'demo-seed'),
    (v_surftown,   350000.00, '2024-11-15', 'demo-seed'),
    (v_curma,      290000.00, '2024-11-16', 'demo-seed'),
    (v_feed_inc,   250000.00, '2024-11-18', 'demo-seed'),
    (v_starlight,  200000.00, '2024-11-20', 'demo-seed'),
    (v_greenpeace, 127500.00, '2024-11-22', 'demo-seed');

  -- ============================================================
  -- 7. Insert new deployments
  --    Spread across Bacnotan, Bauang, Luna + more San Juan
  --    All tagged with notes='demo-seed' for easy cleanup
  -- ============================================================

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
  -- 9. Insert demo needs (submissions with type='need')
  --    Spread across barangays with varied statuses and access
  -- ============================================================
  INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, aid_category_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, created_at) VALUES
    -- Verified needs (live on map)
    (v_event, 'need', 'verified',   'Kap. Maria Santos',    v_brgy_urbiztondo,   v_lunas,      'lunas',      16.6690, 120.3230, 'truck',     50, 'critical', 'Medical supplies for 50 families — multiple injuries from debris', '2024-11-11 08:00:00+08'),
    (v_event, 'need', 'verified',   'Kap. Jose Reyes',      v_brgy_bacnotan,     v_sustenance, 'sustenance', 16.7345, 120.3475, '4x4',       80, 'high',     'Food and water for 80 families — supplies running low',             '2024-11-11 09:30:00+08'),
    (v_event, 'need', 'verified',   'Ldr. Ana Cruz',        v_brgy_nalvo,        v_shelter,    'shelter',    16.8090, 120.3690, 'foot_only', 30, 'critical', '30 homes destroyed — need tarps and building materials',            '2024-11-11 10:00:00+08'),
    (v_event, 'need', 'verified',   'Ldr. Pedro Gomez',     v_brgy_paringao,     v_sustenance, 'sustenance', 16.5150, 120.3290, 'boat',      60, 'high',     'Flooding cut road access — boat needed for food delivery',          '2024-11-12 07:00:00+08'),
    (v_event, 'need', 'verified',   'Vol. Rica Tan',        v_brgy_guerrero,     v_lunas,      'lunas',      16.7260, 120.3550, 'truck',     25, 'medium',   'First aid kits needed for minor injuries',                          '2024-11-12 11:00:00+08'),
    -- In-transit (donor committed)
    (v_event, 'need', 'in_transit', 'Kap. Luis Aquino',     v_brgy_central_east, v_sustenance, 'sustenance', 16.5380, 120.3400, 'truck',     100, 'high',    'EcoNest committed 420 relief packs — en route',                    '2024-11-11 14:00:00+08'),
    (v_event, 'need', 'in_transit', 'Ldr. Rosa Bautista',   v_brgy_dili,         v_shelter,    'shelter',    16.7420, 120.3510, '4x4',       40, 'high',     'Art Relief deploying construction materials',                       '2024-11-12 08:00:00+08'),
    -- Completed (fulfilled)
    (v_event, 'need', 'completed',  'Kap. Elena Ramos',     v_brgy_poblacion_sj, v_sustenance, 'sustenance', 16.6640, 120.3290, 'truck',     70, 'high',     'LU Citizen Volunteers delivered 480 meals',                        '2024-11-11 06:00:00+08'),
    (v_event, 'need', 'completed',  'Vol. Marco Diaz',      v_brgy_baccuit,      v_lunas,      'lunas',      16.5462, 120.3312, 'truck',     35, 'medium',   'La Union Surf Club delivered 120 medical kits',                    '2024-11-12 09:00:00+08'),
    -- Pending (unverified, not yet visible on map)
    (v_event, 'need', 'pending',    'Caller: unknown',      v_brgy_poblacion_lu, v_sustenance, 'sustenance', 16.8015, 120.3735, 'cut_off',   45, 'critical', 'Unverified report of cut-off community needing food — checking',   '2024-11-13 06:00:00+08');

  -- Link existing deployments to the event
  UPDATE deployments SET event_id = v_event WHERE notes = 'demo-seed';

  RAISE NOTICE 'Demo seed complete!';
END $$;
