import { supabase } from "./supabase";

// --- Display Types ---

export type NeedPoint = {
  id: string;
  lat: number;
  lng: number;
  status: "pending" | "verified" | "in_transit" | "confirmed";
  categories: { id: string; name: string; icon: string }[];
  accessStatus: string;
  urgency: string;
  numPeople: number;
  contactName: string;
  contactPhone: string | null;
  notes: string | null;
  hubId: string | null;
  deliveryPhotoUrl: string | null;
  createdAt: string;
};

export type HubPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description: string | null;
  notes: string | null;
  inventory: { categoryName: string; categoryIcon: string }[];
};

export type HazardPoint = {
  id: string;
  description: string;
  photoUrl: string | null;
  lat: number;
  lng: number;
  status: string;
  reportedBy: string | null;
  createdAt: string;
};

// --- Insert Types ---

export interface NeedInsert {
  id?: string;
  event_id: string;
  hub_id?: string | null;
  lat: number;
  lng: number;
  access_status: string;
  urgency: string;
  num_people: number;
  contact_name: string;
  contact_phone?: string;
  notes?: string;
  category_ids: string[];
}

export interface DonationInsert {
  event_id: string;
  organization_id: string;
  donor_name?: string;
  donor_type?: "individual" | "organization";
  type: "cash" | "in_kind";
  amount?: number;
  date: string;
  notes?: string;
  category_ids?: string[];
}

export interface PurchaseInsert {
  event_id: string;
  organization_id: string;
  cost: number;
  date: string;
  notes?: string;
  category_ids: string[];
}

export interface HazardInsert {
  event_id: string;
  description: string;
  photo_url?: string;
  latitude: number;
  longitude: number;
  reported_by?: string;
}

export interface DeploymentInsert {
  event_id: string;
  hub_id: string;
  need_id: string;
  date: string;
  notes?: string;
}

// --- Event queries ---

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

// --- Needs queries ---

export async function getNeedsMapPoints(eventId: string): Promise<NeedPoint[]> {
  const { data, error } = await supabase
    .from("needs")
    .select(
      "id, lat, lng, status, access_status, urgency, num_people, contact_name, contact_phone, notes, hub_id, delivery_photo_url, created_at, need_categories(aid_categories(id, name, icon))"
    )
    .eq("event_id", eventId)
    .in("status", ["pending", "verified", "in_transit"]);

  if (error) throw error;
  return data.map((row) => {
    const cats = (
      row.need_categories as unknown as {
        aid_categories: { id: string; name: string; icon: string };
      }[]
    ).map((nc) => nc.aid_categories);

    return {
      id: row.id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      status: row.status as NeedPoint["status"],
      categories: cats,
      accessStatus: row.access_status,
      urgency: row.urgency,
      numPeople: row.num_people,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      notes: row.notes,
      hubId: row.hub_id,
      deliveryPhotoUrl: row.delivery_photo_url,
      createdAt: row.created_at as string,
    };
  });
}

export async function insertNeed(need: NeedInsert) {
  const { error } = await supabase.rpc("insert_need", {
    p_event_id: need.event_id,
    p_lat: need.lat,
    p_lng: need.lng,
    p_access_status: need.access_status,
    p_urgency: need.urgency,
    p_num_people: need.num_people,
    p_contact_name: need.contact_name,
    p_contact_phone: need.contact_phone ?? null,
    p_notes: need.notes ?? null,
    p_hub_id: need.hub_id ?? null,
    p_category_ids: need.category_ids,
  });

  if (error) throw error;
}

export async function updateNeedStatus(
  id: string,
  status: string,
  deliveryPhotoUrl?: string,
) {
  const update: Record<string, string> = { status };
  if (deliveryPhotoUrl) update.delivery_photo_url = deliveryPhotoUrl;
  const { error } = await supabase.from("needs").update(update).eq("id", id);
  if (error) throw error;
}

// --- Aid categories ---

export async function getAidCategories() {
  const { data, error } = await supabase
    .from("aid_categories")
    .select("id, name, icon")
    .order("name");

  if (error) throw error;
  return data;
}

// --- Hub queries ---

export async function getDeploymentHubs(eventId: string): Promise<HubPoint[]> {
  const { data, error } = await supabase
    .from("deployment_hubs")
    .select(
      "id, name, lat, lng, description, notes, hub_inventory(aid_categories(name, icon))"
    )
    .eq("event_id", eventId);

  if (error) throw error;

  return (data ?? []).map((hub) => {
    const inventory = (
      hub.hub_inventory as unknown as {
        aid_categories: { name: string; icon: string };
      }[]
    ).map((hi) => ({
      categoryName: hi.aid_categories.name,
      categoryIcon: hi.aid_categories.icon,
    }));

    return {
      id: hub.id,
      name: hub.name,
      lat: Number(hub.lat),
      lng: Number(hub.lng),
      description: hub.description,
      notes: hub.notes,
      inventory,
    };
  });
}

export async function getHubs(eventId: string) {
  const { data, error } = await supabase
    .from("deployment_hubs")
    .select("id, name")
    .eq("event_id", eventId)
    .order("name");

  if (error) throw error;
  return data;
}

// --- Hazard queries ---

export async function getHazards(eventId: string): Promise<HazardPoint[]> {
  const { data, error } = await supabase
    .from("hazards")
    .select("id, description, photo_url, latitude, longitude, status, reported_by, created_at")
    .eq("event_id", eventId)
    .eq("status", "active");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    photoUrl: row.photo_url,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    status: row.status,
    reportedBy: row.reported_by,
    createdAt: row.created_at as string,
  }));
}

export async function insertHazard(hazard: HazardInsert) {
  const { error } = await supabase.from("hazards").insert(hazard);
  if (error) throw error;
}

export async function resolveHazard(id: string) {
  const { error } = await supabase
    .from("hazards")
    .update({ status: "resolved" })
    .eq("id", id);
  if (error) throw error;
}

// --- Organization queries ---

export async function getOrganizations(eventId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("event_id", eventId)
    .order("name");

  if (error) throw error;
  return data;
}

// --- Donation queries ---

export async function getTotalDonations(eventId: string) {
  const { data, error } = await supabase
    .from("donations")
    .select("amount")
    .eq("event_id", eventId)
    .eq("type", "cash");

  if (error) throw error;
  return data.reduce((sum, row) => sum + Number(row.amount), 0);
}

export async function getDonationsByOrganization(eventId: string) {
  const { data, error } = await supabase
    .from("donations")
    .select("amount, organizations(name)")
    .eq("event_id", eventId)
    .eq("type", "cash");

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

export async function insertDonation(donation: DonationInsert) {
  const { error } = await supabase.rpc("insert_donation", {
    p_event_id: donation.event_id,
    p_organization_id: donation.organization_id,
    p_type: donation.type,
    p_date: donation.date,
    p_donor_name: donation.donor_name ?? null,
    p_donor_type: donation.donor_type ?? null,
    p_amount: donation.amount ?? null,
    p_notes: donation.notes ?? null,
    p_category_ids: donation.category_ids ?? [],
  });

  if (error) throw error;
}

// --- Purchase queries ---

export async function getTotalSpent(eventId: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select("cost")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
}

export async function getRecentPurchases(eventId: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, cost, date, notes, created_at, organizations(name), purchase_categories(aid_categories(name, icon))")
    .eq("event_id", eventId)
    .order("date", { ascending: false })
    .limit(10);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const cats = (
      row.purchase_categories as unknown as {
        aid_categories: { name: string; icon: string };
      }[]
    ).map((pc) => ({
      name: pc.aid_categories.name,
      icon: pc.aid_categories.icon,
    }));

    return {
      id: row.id,
      cost: row.cost,
      date: row.date,
      notes: row.notes,
      orgName: (row.organizations as unknown as { name: string })?.name ?? "",
      categories: cats,
    };
  });
}

export async function insertPurchase(purchase: PurchaseInsert) {
  const { error } = await supabase.rpc("insert_purchase", {
    p_event_id: purchase.event_id,
    p_organization_id: purchase.organization_id,
    p_cost: purchase.cost,
    p_date: purchase.date,
    p_notes: purchase.notes ?? null,
    p_category_ids: purchase.category_ids,
  });

  if (error) throw error;
}

// --- Beneficiaries ---

export async function getTotalBeneficiaries(eventId: string) {
  const { data, error } = await supabase
    .from("needs")
    .select("num_people")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.num_people ?? 0), 0);
}

// --- Deployments ---

export async function createDeployment(deployment: DeploymentInsert) {
  const { error } = await supabase.rpc("create_deployment", {
    p_event_id: deployment.event_id,
    p_hub_id: deployment.hub_id,
    p_need_id: deployment.need_id,
    p_date: deployment.date,
    p_notes: deployment.notes ?? null,
  });

  if (error) throw error;
}
