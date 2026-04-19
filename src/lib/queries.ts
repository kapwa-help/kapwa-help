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
  contactPhone: string | null;
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
  id?: string;
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
  id?: string;
  event_id: string;
  organization_id: string;
  cost: number;
  date: string;
  notes?: string;
  category_ids: string[];
}

export interface HazardInsert {
  id?: string;
  event_id: string;
  description: string;
  photo_url?: string;
  latitude: number;
  longitude: number;
  reported_by?: string;
  contact_phone?: string;
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

// Raw row shapes returned by Supabase. .from(source).select(fields) with
// dynamic source/fields is inherently untyped from Supabase's side — these
// interfaces name the shapes we explicitly ask for above each query.
interface NeedRowBase {
  id: string;
  lat: number | string;
  lng: number | string;
  status: NeedPoint["status"];
  access_status: string;
  urgency: string;
  num_people: number;
  notes: string | null;
  hub_id: string | null;
  delivery_photo_url: string | null;
  created_at: string;
}

interface NeedRowAdmin extends NeedRowBase {
  contact_name: string;
  contact_phone: string | null;
  need_categories: {
    aid_categories: { id: string; name: string; icon: string };
  }[];
}

type NeedRowPublic = NeedRowBase;

export async function getNeedsMapPoints(
  eventId: string,
  isAdmin: boolean,
): Promise<NeedPoint[]> {
  const source = isAdmin ? "needs" : "needs_public";
  const fields = isAdmin
    ? "id, lat, lng, status, access_status, urgency, num_people, contact_name, contact_phone, notes, hub_id, delivery_photo_url, created_at, need_categories(aid_categories(id, name, icon))"
    : "id, lat, lng, status, access_status, urgency, num_people, notes, hub_id, delivery_photo_url, created_at";

  const { data, error } = await supabase
    .from(source)
    .select(fields)
    .eq("event_id", eventId)
    .in("status", ["pending", "verified", "in_transit"]);
  if (error) throw error;

  if (isAdmin) {
    const rows = (data ?? []) as unknown as NeedRowAdmin[];
    return rows.map((row) => ({
      id: row.id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      status: row.status,
      categories: row.need_categories.map((nc) => nc.aid_categories),
      accessStatus: row.access_status,
      urgency: row.urgency,
      numPeople: row.num_people,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      notes: row.notes,
      hubId: row.hub_id,
      deliveryPhotoUrl: row.delivery_photo_url,
      createdAt: row.created_at,
    }));
  }

  const rows = (data ?? []) as unknown as NeedRowPublic[];
  return rows.map((row) => ({
    id: row.id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    status: row.status,
    categories: [],
    accessStatus: row.access_status,
    urgency: row.urgency,
    numPeople: row.num_people,
    contactName: "",
    contactPhone: null,
    notes: row.notes,
    hubId: row.hub_id,
    deliveryPhotoUrl: row.delivery_photo_url,
    createdAt: row.created_at,
  }));
}

export async function insertNeed(need: NeedInsert) {
  const { error } = await supabase.rpc("insert_need", {
    p_id: need.id ?? null,
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

interface HazardRowBase {
  id: string;
  description: string;
  photo_url: string | null;
  latitude: number | string;
  longitude: number | string;
  status: string;
  created_at: string;
}

interface HazardRowAdmin extends HazardRowBase {
  reported_by: string | null;
  contact_phone: string | null;
}

type HazardRowPublic = HazardRowBase;

export async function getHazards(
  eventId: string,
  isAdmin: boolean,
): Promise<HazardPoint[]> {
  const source = isAdmin ? "hazards" : "hazards_public";
  const fields = isAdmin
    ? "id, description, photo_url, latitude, longitude, status, reported_by, contact_phone, created_at"
    : "id, description, photo_url, latitude, longitude, status, created_at";

  const { data, error } = await supabase
    .from(source)
    .select(fields)
    .eq("event_id", eventId)
    .eq("status", "active");
  if (error) throw error;

  if (isAdmin) {
    const rows = (data ?? []) as unknown as HazardRowAdmin[];
    return rows.map((row) => ({
      id: row.id,
      description: row.description,
      photoUrl: row.photo_url,
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      status: row.status,
      reportedBy: row.reported_by,
      contactPhone: row.contact_phone,
      createdAt: row.created_at,
    }));
  }

  const rows = (data ?? []) as unknown as HazardRowPublic[];
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    photoUrl: row.photo_url,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    status: row.status,
    reportedBy: null,
    contactPhone: null,
    createdAt: row.created_at,
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
    p_id: donation.id ?? null,
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
    p_id: purchase.id ?? null,
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
