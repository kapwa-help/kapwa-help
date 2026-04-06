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
    .select("quantity")
    .eq("status", "received");

  if (error) throw error;
  return data.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
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

export async function getGoodsByCategory() {
  const { data, error } = await supabase
    .from("deployments")
    .select("quantity, aid_categories(name, icon)")
    .eq("status", "received");

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

// --- Needs coordination queries ---

export type NeedPoint = {
  id: string;
  lat: number;
  lng: number;
  status: string;
  aidCategoryId: string | null;
  aidCategoryName: string | null;
  aidCategoryIcon: string | null;
  accessStatus: string | null;
  urgency: string | null;
  quantityNeeded: number | null;
  numAdults: number;
  numChildren: number;
  numSeniorsPwd: number;
  notes: string | null;
  contactName: string;
  barangayName: string;
  municipality: string;
  createdAt: string;
};

export async function getNeedsMapPoints(eventId: string): Promise<NeedPoint[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, lat, lng, status, aid_category_id, access_status, urgency, quantity_needed, num_adults, num_children, num_seniors_pwd, notes, contact_name, created_at, barangays(name, municipality), aid_categories(name, icon)"
    )
    .eq("event_id", eventId)
    .neq("status", "resolved")
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) throw error;
  return data.map((row) => {
    const brgy = row.barangays as unknown as { name: string; municipality: string };
    const cat = row.aid_categories as unknown as { name: string; icon: string | null };
    return {
      id: row.id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      status: row.status,
      aidCategoryId: row.aid_category_id,
      aidCategoryName: cat?.name ?? null,
      aidCategoryIcon: cat?.icon ?? null,
      accessStatus: row.access_status,
      urgency: row.urgency,
      quantityNeeded: row.quantity_needed,
      numAdults: row.num_adults ?? 0,
      numChildren: row.num_children ?? 0,
      numSeniorsPwd: row.num_seniors_pwd ?? 0,
      notes: row.notes,
      contactName: row.contact_name,
      barangayName: brgy?.name ?? "",
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
  id?: string;
  event_id?: string | null;
  contact_name: string;
  contact_phone: string | null;
  barangay_id: string;
  aid_category_id: string;
  access_status: string;
  notes: string | null;
  quantity_needed: number | null;
  urgency: string;
  num_adults: number | null;
  num_children: number | null;
  num_seniors_pwd: number | null;
  lat: number | null;
  lng: number | null;
  geohash?: string | null;
  submission_photo_url?: string | null;
  dispatch_photo_url?: string | null;
  delivery_photo_url?: string | null;
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
    .select("id, name, icon")
    .order("name");

  if (error) throw error;
  return data;
}

export async function insertSubmission(submission: SubmissionInsert) {
  const { error } = await supabase.from("submissions").insert(submission);

  if (error) throw error;
}

// --- Matchmaker queries ---

export interface DeploymentInsert {
  event_id?: string | null;
  organization_id: string;
  aid_category_id: string;
  submission_id: string;
  barangay_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
}

export async function createDeploymentForNeed(deployment: DeploymentInsert) {
  const { error: deployError } = await supabase
    .from("deployments")
    .upsert({ ...deployment, status: "pending" }, { onConflict: "submission_id" });

  if (deployError) throw deployError;

  const { error: statusError } = await supabase
    .from("submissions")
    .update({ status: "in_transit" })
    .eq("id", deployment.submission_id);

  if (statusError) throw statusError;
}

export async function updateDeploymentStatus(submissionId: string, status: "pending" | "received") {
  const { error } = await supabase
    .from("deployments")
    .update({ status })
    .eq("submission_id", submissionId);

  if (error) throw error;
}

export async function getOrganizations() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, municipality")
    .order("name");

  if (error) throw error;
  return data;
}

// --- Purchase & Donation insert ---

export interface PurchaseInsert {
  event_id?: string | null;
  organization_id: string;
  aid_category_id: string;
  quantity: number;
  unit: string | null;
  cost: number | null;
  date: string;
  notes: string | null;
}

export async function insertPurchase(purchase: PurchaseInsert) {
  const { error } = await supabase.from("purchases").insert(purchase);
  if (error) throw error;
}

export interface DonationInsert {
  organization_id: string;
  amount: number;
  date: string;
  notes: string | null;
}

export async function insertDonation(donation: DonationInsert) {
  const { error } = await supabase.from("donations").insert(donation);
  if (error) throw error;
}

// --- Hub queries ---

export type HubPoint = {
  id: string;
  name: string;
  municipality: string | null;
  lat: number;
  lng: number;
  inventory: { categoryName: string; categoryIcon: string | null; available: number }[];
};

export async function getDeploymentHubs(eventId: string): Promise<HubPoint[]> {
  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, municipality, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (orgError) throw orgError;
  if (!orgs?.length) return [];

  const { data: purchases, error: purchaseError } = await supabase
    .from("purchases")
    .select("organization_id, quantity, aid_categories(name, icon)")
    .eq("event_id", eventId);
  if (purchaseError) throw purchaseError;

  const { data: deployments, error: deployError } = await supabase
    .from("deployments")
    .select("organization_id, quantity, aid_categories(name, icon)")
    .eq("event_id", eventId)
    .eq("status", "received");
  if (deployError) throw deployError;

  const orgInventory = new Map<string, Map<string, { name: string; icon: string | null; purchased: number; deployed: number }>>();

  for (const row of purchases ?? []) {
    const cat = row.aid_categories as unknown as { name: string; icon: string | null };
    if (!cat) continue;
    if (!orgInventory.has(row.organization_id)) orgInventory.set(row.organization_id, new Map());
    const inv = orgInventory.get(row.organization_id)!;
    if (!inv.has(cat.name)) inv.set(cat.name, { name: cat.name, icon: cat.icon, purchased: 0, deployed: 0 });
    inv.get(cat.name)!.purchased += row.quantity ?? 0;
  }

  for (const row of deployments ?? []) {
    const cat = row.aid_categories as unknown as { name: string; icon: string | null };
    if (!cat) continue;
    if (!orgInventory.has(row.organization_id)) orgInventory.set(row.organization_id, new Map());
    const inv = orgInventory.get(row.organization_id)!;
    if (!inv.has(cat.name)) inv.set(cat.name, { name: cat.name, icon: cat.icon, purchased: 0, deployed: 0 });
    inv.get(cat.name)!.deployed += row.quantity ?? 0;
  }

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    municipality: org.municipality,
    lat: Number(org.lat),
    lng: Number(org.lng),
    inventory: Array.from(orgInventory.get(org.id)?.values() ?? []).map((item) => ({
      categoryName: item.name,
      categoryIcon: item.icon,
      available: item.purchased - item.deployed,
    })),
  }));
}

// --- Hazard queries ---

export type HazardPoint = {
  id: string;
  hazardType: string;
  description: string | null;
  photoUrl: string | null;
  lat: number;
  lng: number;
  status: string;
  reportedBy: string | null;
  createdAt: string;
};

export async function getHazards(eventId: string): Promise<HazardPoint[]> {
  const { data, error } = await supabase
    .from("hazards")
    .select("id, hazard_type, description, photo_url, latitude, longitude, status, reported_by, created_at")
    .eq("event_id", eventId)
    .eq("status", "active");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    hazardType: row.hazard_type,
    description: row.description,
    photoUrl: row.photo_url,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    status: row.status,
    reportedBy: row.reported_by,
    createdAt: row.created_at as string,
  }));
}

export interface HazardInsert {
  event_id?: string | null;
  hazard_type: string;
  description: string | null;
  photo_url?: string | null;
  latitude: number;
  longitude: number;
  reported_by: string | null;
}

export async function insertHazard(hazard: HazardInsert) {
  const { error } = await supabase.from("hazards").insert(hazard);
  if (error) throw error;
}

// --- Deployments page queries ---

export async function getBarangayDistribution(eventId: string) {
  const { data, error } = await supabase
    .from("deployments")
    .select("quantity, unit, date, barangays(id, name, municipality, lat, lng), aid_categories(name, icon), organizations(name)")
    .eq("event_id", eventId)
    .eq("status", "received");
  if (error) throw error;

  const byBarangay = new Map<string, {
    id: string;
    name: string;
    municipality: string;
    lat: number;
    lng: number;
    categories: Map<string, { name: string; icon: string | null; total: number }>;
    totalQuantity: number;
    deployments: { orgName: string; categoryName: string; categoryIcon: string | null; quantity: number | null; unit: string | null; date: string | null }[];
  }>();

  for (const row of data ?? []) {
    const brgy = row.barangays as unknown as { id: string; name: string; municipality: string; lat: number; lng: number };
    const cat = row.aid_categories as unknown as { name: string; icon: string | null };
    const org = row.organizations as unknown as { name: string };
    if (!brgy) continue;

    if (!byBarangay.has(brgy.id)) {
      byBarangay.set(brgy.id, {
        id: brgy.id,
        name: brgy.name,
        municipality: brgy.municipality,
        lat: brgy.lat,
        lng: brgy.lng,
        categories: new Map(),
        totalQuantity: 0,
        deployments: [],
      });
    }

    const entry = byBarangay.get(brgy.id)!;
    const catName = cat?.name ?? "Unknown";
    if (!entry.categories.has(catName)) {
      entry.categories.set(catName, { name: catName, icon: cat?.icon ?? null, total: 0 });
    }
    entry.categories.get(catName)!.total += row.quantity ?? 0;
    entry.totalQuantity += row.quantity ?? 0;
    entry.deployments.push({
      orgName: org?.name ?? "",
      categoryName: catName,
      categoryIcon: cat?.icon ?? null,
      quantity: row.quantity,
      unit: row.unit,
      date: row.date,
    });
  }

  return Array.from(byBarangay.values()).map((b) => ({
    ...b,
    categories: Array.from(b.categories.values()),
    deployments: b.deployments.sort((a, c) => (c.date ?? "").localeCompare(a.date ?? "")),
  }));
}

export async function getPeopleServed(eventId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("num_adults, num_children, num_seniors_pwd")
    .eq("event_id", eventId)
    .eq("status", "resolved");
  if (error) throw error;

  return (data ?? []).reduce(
    (acc, row) => ({
      adults: acc.adults + (row.num_adults ?? 0),
      children: acc.children + (row.num_children ?? 0),
      seniorsPwd: acc.seniorsPwd + (row.num_seniors_pwd ?? 0),
    }),
    { adults: 0, children: 0, seniorsPwd: 0 }
  );
}

export async function getRecentDeployments(eventId: string) {
  const { data, error } = await supabase
    .from("deployments")
    .select("id, quantity, unit, date, notes, status, created_at, organizations(name), aid_categories(name, icon), barangays(name, municipality)")
    .eq("event_id", eventId)
    .eq("status", "received")
    .order("date", { ascending: false })
    .limit(10);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    quantity: row.quantity,
    unit: row.unit,
    date: row.date,
    notes: row.notes,
    orgName: (row.organizations as unknown as { name: string })?.name ?? "",
    categoryName: (row.aid_categories as unknown as { name: string })?.name ?? "",
    categoryIcon: (row.aid_categories as unknown as { icon: string | null })?.icon ?? null,
    barangayName: (row.barangays as unknown as { name: string })?.name ?? "",
    municipality: (row.barangays as unknown as { municipality: string })?.municipality ?? "",
  }));
}

// --- Relief Operations page queries ---

export async function getTotalSpent() {
  const { data, error } = await supabase
    .from("purchases")
    .select("cost");
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
}

export async function getRecentPurchases(eventId: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, quantity, unit, cost, date, notes, created_at, organizations(name), aid_categories(name, icon)")
    .eq("event_id", eventId)
    .order("date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    quantity: row.quantity,
    unit: row.unit,
    cost: row.cost,
    date: row.date,
    notes: row.notes,
    orgName: (row.organizations as unknown as { name: string })?.name ?? "",
    categoryName: (row.aid_categories as unknown as { name: string })?.name ?? "",
    categoryIcon: (row.aid_categories as unknown as { icon: string | null })?.icon ?? null,
  }));
}

export async function getAvailableInventory(eventId: string) {
  const { data: purchaseData, error: purchaseError } = await supabase
    .from("purchases")
    .select("quantity, aid_categories(id, name, icon)")
    .eq("event_id", eventId);
  if (purchaseError) throw purchaseError;

  const { data: deployData, error: deployError } = await supabase
    .from("deployments")
    .select("quantity, aid_categories(id, name, icon)")
    .eq("event_id", eventId)
    .eq("status", "received");
  if (deployError) throw deployError;

  const inventory = new Map<string, { name: string; icon: string | null; purchased: number; deployed: number }>();

  for (const row of purchaseData ?? []) {
    const cat = row.aid_categories as unknown as { id: string; name: string; icon: string | null };
    if (!cat) continue;
    if (!inventory.has(cat.id)) {
      inventory.set(cat.id, { name: cat.name, icon: cat.icon, purchased: 0, deployed: 0 });
    }
    inventory.get(cat.id)!.purchased += row.quantity ?? 0;
  }

  for (const row of deployData ?? []) {
    const cat = row.aid_categories as unknown as { id: string; name: string; icon: string | null };
    if (!cat) continue;
    if (!inventory.has(cat.id)) {
      inventory.set(cat.id, { name: cat.name, icon: cat.icon, purchased: 0, deployed: 0 });
    }
    inventory.get(cat.id)!.deployed += row.quantity ?? 0;
  }

  return Array.from(inventory.values()).map((item) => ({
    ...item,
    available: item.purchased - item.deployed,
  }));
}
