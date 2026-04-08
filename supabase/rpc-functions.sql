-- ============================================================
-- Kapwa Help — RPC Functions (atomic multi-table inserts)
-- ============================================================
-- Each function wraps a parent + junction table insert in a
-- single transaction so partial writes can't create orphaned rows.

-- Insert a need with its category junction rows
CREATE OR REPLACE FUNCTION insert_need(
  p_event_id uuid,
  p_lat decimal(9,6),
  p_lng decimal(9,6),
  p_access_status access_status,
  p_urgency urgency_level,
  p_num_people integer,
  p_contact_name text,
  p_contact_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_hub_id uuid DEFAULT NULL,
  p_category_ids uuid[] DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_need_id uuid;
BEGIN
  INSERT INTO needs (event_id, lat, lng, access_status, urgency, num_people, contact_name, contact_phone, notes, hub_id)
  VALUES (p_event_id, p_lat, p_lng, p_access_status, p_urgency, p_num_people, p_contact_name, p_contact_phone, p_notes, p_hub_id)
  RETURNING id INTO v_need_id;

  IF array_length(p_category_ids, 1) > 0 THEN
    INSERT INTO need_categories (need_id, aid_category_id)
    SELECT v_need_id, unnest(p_category_ids);
  END IF;

  RETURN v_need_id;
END;
$$;

-- Insert a donation with its category junction rows
CREATE OR REPLACE FUNCTION insert_donation(
  p_event_id uuid,
  p_organization_id uuid,
  p_type donation_type,
  p_date date,
  p_donor_name text DEFAULT NULL,
  p_donor_type donor_type DEFAULT NULL,
  p_amount decimal(12,2) DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_category_ids uuid[] DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_donation_id uuid;
BEGIN
  INSERT INTO donations (event_id, organization_id, type, date, donor_name, donor_type, amount, notes)
  VALUES (p_event_id, p_organization_id, p_type, p_date, p_donor_name, p_donor_type, p_amount, p_notes)
  RETURNING id INTO v_donation_id;

  IF array_length(p_category_ids, 1) > 0 THEN
    INSERT INTO donation_categories (donation_id, aid_category_id)
    SELECT v_donation_id, unnest(p_category_ids);
  END IF;

  RETURN v_donation_id;
END;
$$;

-- Insert a purchase with its category junction rows
CREATE OR REPLACE FUNCTION insert_purchase(
  p_event_id uuid,
  p_organization_id uuid,
  p_cost decimal(12,2),
  p_date date,
  p_notes text DEFAULT NULL,
  p_category_ids uuid[] DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_purchase_id uuid;
BEGIN
  INSERT INTO purchases (event_id, organization_id, cost, date, notes)
  VALUES (p_event_id, p_organization_id, p_cost, p_date, p_notes)
  RETURNING id INTO v_purchase_id;

  IF array_length(p_category_ids, 1) > 0 THEN
    INSERT INTO purchase_categories (purchase_id, aid_category_id)
    SELECT v_purchase_id, unnest(p_category_ids);
  END IF;

  RETURN v_purchase_id;
END;
$$;

-- Create a deployment and update the linked need's status atomically
CREATE OR REPLACE FUNCTION create_deployment(
  p_event_id uuid,
  p_hub_id uuid,
  p_need_id uuid,
  p_date date,
  p_notes text DEFAULT NULL,
  p_status need_status DEFAULT 'in_transit'
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_deployment_id uuid;
BEGIN
  INSERT INTO deployments (event_id, hub_id, need_id, date, notes)
  VALUES (p_event_id, p_hub_id, p_need_id, p_date, p_notes)
  RETURNING id INTO v_deployment_id;

  UPDATE needs SET status = p_status WHERE id = p_need_id;

  RETURN v_deployment_id;
END;
$$;
