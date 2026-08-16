import { supabase } from "./supabase";

// Display type (camelCase, for UI)
export interface FloodReport {
  id: string;
  photoUrl: string;
  lat: number;
  lng: number;
  weatherEvent: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  eventDate: string | null;
  photoTakenAt: string | null;
  createdAt: string;
  // Admin-only fields (null in public view)
  reporterName: string | null;
  reporterPhone: string | null;
}

// Insert type (snake_case, matching DB columns)
export interface FloodReportInsert {
  id: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  event_date: string;
  weather_event?: string;
  description?: string;
  reporter_name?: string;
  reporter_phone?: string;
  photo_taken_at?: string;
}

interface FloodReportRow {
  id: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  weather_event: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  event_date: string | null;
  photo_taken_at: string | null;
  created_at: string;
  reporter_name?: string | null;
  reporter_phone?: string | null;
}

function mapRow(row: FloodReportRow): FloodReport {
  return {
    id: row.id,
    photoUrl: row.photo_url,
    lat: row.latitude,
    lng: row.longitude,
    weatherEvent: row.weather_event,
    description: row.description,
    status: row.status,
    eventDate: row.event_date,
    photoTakenAt: row.photo_taken_at,
    createdAt: row.created_at,
    reporterName: row.reporter_name ?? null,
    reporterPhone: row.reporter_phone ?? null,
  };
}

export async function getApprovedFloodReports(): Promise<FloodReport[]> {
  const { data, error } = await supabase
    .from("flood_reports_public")
    .select("id, photo_url, latitude, longitude, weather_event, description, status, event_date, photo_taken_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as FloodReportRow[]).map(mapRow);
}

export async function getPendingFloodReports(): Promise<FloodReport[]> {
  const { data, error } = await supabase
    .from("flood_reports")
    .select("id, photo_url, latitude, longitude, weather_event, description, status, event_date, photo_taken_at, created_at, reporter_name, reporter_phone")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as FloodReportRow[]).map(mapRow);
}

export async function getAllFloodReports(): Promise<FloodReport[]> {
  const { data, error } = await supabase
    .from("flood_reports")
    .select("id, photo_url, latitude, longitude, weather_event, description, status, event_date, photo_taken_at, created_at, reporter_name, reporter_phone")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as FloodReportRow[]).map(mapRow);
}

export async function insertFloodReport(report: FloodReportInsert): Promise<void> {
  const { error } = await supabase.from("flood_reports").insert(report);
  if (error) throw error;
}

export async function updateFloodReportStatus(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from("flood_reports")
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
