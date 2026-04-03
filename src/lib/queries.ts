import { supabase } from "./supabase";

export async function getTotalDonations() {
  const { data, error } = await supabase
    .from("donations")
    .select("amount");

  if (error) throw error;
  return data.reduce((sum, row) => sum + Number(row.amount), 0);
}

export async function getTotalBeneficiaries() {
  const { data, error } = await supabase
    .from("deployments")
    .select("quantity");

  if (error) throw error;
  return data.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
}

export async function getVolunteerCount() {
  const { data, error } = await supabase
    .from("deployments")
    .select("volunteer_count");

  if (error) throw error;
  return data.reduce((sum, row) => sum + (row.volunteer_count ?? 0), 0);
}

export async function getDonationsByOrganization() {
  const { data, error } = await supabase
    .from("donations")
    .select("amount, organizations(name)");

  if (error) throw error;

  const grouped = data.reduce<Record<string, number>>((acc, row) => {
    const name = (row.organizations as unknown as { name: string })?.name ?? "Unknown";
    acc[name] = (acc[name] ?? 0) + Number(row.amount);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getDeploymentHubs() {
  const { data, error } = await supabase
    .from("deployments")
    .select("organization_id, organizations(name, municipality)");

  if (error) throw error;

  const grouped = data.reduce<
    Record<string, { name: string; municipality: string; count: number }>
  >((acc, row) => {
    const org = row.organizations as unknown as { name: string; municipality: string };
    const id = row.organization_id;
    if (!acc[id]) {
      acc[id] = { name: org?.name ?? "Unknown", municipality: org?.municipality ?? "", count: 0 };
    }
    acc[id].count++;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.count - a.count);
}

export async function getGoodsByCategory() {
  const { data, error } = await supabase
    .from("deployments")
    .select("quantity, aid_categories(name, icon)");

  if (error) throw error;

  const grouped = data.reduce<
    Record<string, { name: string; icon: string | null; total: number }>
  >((acc, row) => {
    const cat = row.aid_categories as unknown as { name: string; icon: string | null };
    const name = cat?.name ?? "Unknown";
    if (!acc[name]) {
      acc[name] = { name, icon: cat?.icon ?? null, total: 0 };
    }
    acc[name].total += row.quantity ?? 0;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.total - a.total);
}

export async function getDeploymentMapPoints() {
  const { data, error } = await supabase
    .from("deployments")
    .select("lat, lng, quantity, unit, organizations(name), aid_categories(name)")
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) throw error;
  return data.map((row) => ({
    lat: Number(row.lat),
    lng: Number(row.lng),
    quantity: row.quantity,
    unit: row.unit,
    orgName: (row.organizations as unknown as { name: string })?.name ?? "Unknown",
    categoryName: (row.aid_categories as unknown as { name: string })?.name ?? "Unknown",
  }));
}

// --- Needs coordination queries ---

export type NeedPoint = {
  id: string;
  lat: number;
  lng: number;
  status: string;
  gapCategory: string | null;
  accessStatus: string | null;
  urgency: string | null;
  quantityNeeded: number | null;
  notes: string | null;
  contactName: string;
  barangayName: string;
  municipality: string;
  createdAt: string;
};

export async function getNeedsMapPoints(): Promise<NeedPoint[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, lat, lng, status, gap_category, access_status, urgency, quantity_needed, notes, contact_name, created_at, barangays(name, municipality)"
    )
    .in("status", ["pending", "verified", "in_transit", "completed"])
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) throw error;
  return data.map((row) => {
    const brgy = row.barangays as unknown as { name: string; municipality: string };
    return {
      id: row.id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      status: row.status,
      gapCategory: row.gap_category,
      accessStatus: row.access_status,
      urgency: row.urgency,
      quantityNeeded: row.quantity_needed,
      notes: row.notes,
      contactName: row.contact_name,
      barangayName: brgy?.name ?? "Unknown",
      municipality: brgy?.municipality ?? "",
      createdAt: row.created_at as string,
    };
  });
}

export async function updateSubmissionStatus(id: string, status: string) {
  const { error } = await supabase
    .from("submissions")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

export async function getActiveEvent() {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, slug, description, region, started_at")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// --- Submission form queries ---

export interface SubmissionInsert {
  id?: string; // Client-generated UUID for idempotent sync
  event_id?: string | null;
  type: "need";
  contact_name: string;
  contact_phone: string | null;
  barangay_id: string;
  gap_category: string;
  access_status: string;
  notes: string | null;
  quantity_needed: number | null;
  urgency: string;
  lat: number | null;
  lng: number | null;
  photo_url?: string | null;
}

export async function getBarangays() {
  const { data, error } = await supabase
    .from("barangays")
    .select("id, name, municipality")
    .order("name");

  if (error) throw error;
  return data;
}

export async function getAidCategories() {
  const { data, error } = await supabase
    .from("aid_categories")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return data;
}

export async function insertSubmission(submission: SubmissionInsert) {
  const { error } = await supabase.from("submissions").insert(submission);

  if (error) throw error;
}

export async function getBeneficiariesByBarangay() {
  const { data, error } = await supabase
    .from("deployments")
    .select("quantity, barangays(name, municipality)")
    .not("barangay_id", "is", null);

  if (error) throw error;

  const grouped = data.reduce<
    Record<string, { name: string; municipality: string; beneficiaries: number }>
  >((acc, row) => {
    const brgy = row.barangays as unknown as { name: string; municipality: string };
    const key = brgy?.name ?? "Unknown";
    if (!acc[key]) {
      acc[key] = { name: brgy?.name ?? "Unknown", municipality: brgy?.municipality ?? "", beneficiaries: 0 };
    }
    acc[key].beneficiaries += row.quantity ?? 0;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.beneficiaries - a.beneficiaries);
}
