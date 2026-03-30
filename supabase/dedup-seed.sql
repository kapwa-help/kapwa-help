-- dedup-seed.sql — Clean up duplicate rows from double seed run
-- Run in the Supabase SQL Editor.
--
-- Strategy: The seed ran twice, creating duplicate organizations and barangays
-- with new UUIDs each time. Donations and deployments from run 2 reference
-- these duplicate IDs. We identify the canonical (oldest) row per name,
-- delete child records referencing duplicates, then delete the duplicates.
--
-- FK dependency chain:
--   organizations ← donations, deployments
--   barangays     ← deployments, submissions
--
-- Safe: submissions reference only run-1 barangays (count=15, no dupes).

BEGIN;

-- ============================================================
-- 1. Identify duplicate IDs
-- ============================================================

-- Duplicate orgs: newer copy of each name pair
CREATE TEMP TABLE dup_orgs AS
  SELECT o.id AS dup_id, c.keep_id, o.name
  FROM organizations o
  JOIN (
    SELECT DISTINCT ON (name) id AS keep_id, name
    FROM organizations ORDER BY name, created_at ASC
  ) c ON o.name = c.name AND o.id != c.keep_id;

-- Duplicate barangays: newer copy of each (name, municipality) pair
CREATE TEMP TABLE dup_brgys AS
  SELECT b.id AS dup_id, c.keep_id, b.name, b.municipality
  FROM barangays b
  JOIN (
    SELECT DISTINCT ON (name, municipality) id AS keep_id, name, municipality
    FROM barangays ORDER BY name, municipality, created_at ASC
  ) c ON b.name = c.name AND b.municipality = c.municipality AND b.id != c.keep_id;

-- ============================================================
-- 2. Preview what will be deleted (check before proceeding)
-- ============================================================
DO $$
DECLARE
  v_dup_orgs      int;
  v_dup_brgys     int;
  v_dup_deploys   int;
  v_dup_donations int;
  v_dup_donations_preexisting int;
BEGIN
  SELECT count(*) INTO v_dup_orgs FROM dup_orgs;
  SELECT count(*) INTO v_dup_brgys FROM dup_brgys;

  -- Deployments from run 2: all reference duplicate barangay IDs
  SELECT count(*) INTO v_dup_deploys
    FROM deployments WHERE barangay_id IN (SELECT dup_id FROM dup_brgys);

  -- Donations referencing duplicate org IDs (new orgs from run 2)
  SELECT count(*) INTO v_dup_donations
    FROM donations WHERE organization_id IN (SELECT dup_id FROM dup_orgs);

  -- Donations referencing pre-existing orgs that were inserted twice
  -- (same org_id, same amount, same date — keep the oldest)
  SELECT count(*) INTO v_dup_donations_preexisting
    FROM donations d
    WHERE d.notes = 'demo-seed'
      AND d.organization_id NOT IN (SELECT dup_id FROM dup_orgs)
      AND d.id NOT IN (
        SELECT DISTINCT ON (organization_id, amount, date)
          id FROM donations
          WHERE notes = 'demo-seed'
          ORDER BY organization_id, amount, date, created_at ASC
      );

  RAISE NOTICE '--- DRY RUN PREVIEW ---';
  RAISE NOTICE 'Duplicate orgs to delete:      %', v_dup_orgs;
  RAISE NOTICE 'Duplicate barangays to delete:  %', v_dup_brgys;
  RAISE NOTICE 'Deployments to delete (run 2):  %', v_dup_deploys;
  RAISE NOTICE 'Donations to delete (new orgs): %', v_dup_donations;
  RAISE NOTICE 'Donations to delete (pre-existing org dupes): %', v_dup_donations_preexisting;
END $$;

-- ============================================================
-- 3. Delete child records first (bottom of FK chain)
-- ============================================================

-- 3a. Delete deployments from run 2
--     All run-2 deployments reference run-2 barangay IDs
DELETE FROM deployments
  WHERE barangay_id IN (SELECT dup_id FROM dup_brgys);

-- 3b. Delete donations referencing duplicate (run-2) org IDs
DELETE FROM donations
  WHERE organization_id IN (SELECT dup_id FROM dup_orgs);

-- 3c. Delete duplicate donations referencing pre-existing orgs
--     (same org, amount, date — keep the oldest by created_at)
DELETE FROM donations
  WHERE notes = 'demo-seed'
    AND organization_id NOT IN (SELECT dup_id FROM dup_orgs)
    AND id NOT IN (
      SELECT DISTINCT ON (organization_id, amount, date)
        id FROM donations
        WHERE notes = 'demo-seed'
        ORDER BY organization_id, amount, date, created_at ASC
    );

-- ============================================================
-- 4. Delete duplicate parent rows
-- ============================================================
DELETE FROM organizations WHERE id IN (SELECT dup_id FROM dup_orgs);
DELETE FROM barangays    WHERE id IN (SELECT dup_id FROM dup_brgys);

-- ============================================================
-- 5. Verify final counts
-- ============================================================
DO $$
DECLARE
  v_orgs   int;
  v_brgys  int;
  v_dons   int;
  v_deps   int;
  v_subs   int;
BEGIN
  SELECT count(*) INTO v_orgs FROM organizations;
  SELECT count(*) INTO v_brgys FROM barangays;
  SELECT count(*) INTO v_dons FROM donations;
  SELECT count(*) INTO v_deps FROM deployments;
  SELECT count(*) INTO v_subs FROM submissions;

  RAISE NOTICE '--- FINAL COUNTS ---';
  RAISE NOTICE 'Organizations: % (expected ~16)', v_orgs;
  RAISE NOTICE 'Barangays:     % (expected ~10)', v_brgys;
  RAISE NOTICE 'Donations:     % (expected 8)', v_dons;
  RAISE NOTICE 'Deployments:   % (expected ~51)', v_deps;
  RAISE NOTICE 'Submissions:   % (expected 15)', v_subs;
END $$;

-- Cleanup temp tables
DROP TABLE dup_orgs;
DROP TABLE dup_brgys;

COMMIT;
