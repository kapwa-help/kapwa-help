const DB_NAME = "luaid";
const DB_VERSION = 2;
const STORE_NAME = "dashboard";
const CACHE_KEY = "latest";

export type DashboardData = {
  // Existing fields
  totalDonations: number;
  totalBeneficiaries: number;
  volunteerCount: number;
  donationsByOrg: { name: string; amount: number }[];
  deploymentHubs: { name: string; municipality: string; count: number }[];
  goodsByCategory: { name: string; icon: string | null; total: number }[];
  barangays: { name: string; municipality: string; beneficiaries: number }[];
  deploymentPoints: {
    lat: number;
    lng: number;
    quantity: number | null;
    unit: string | null;
    orgName: string;
    categoryName: string;
  }[];
  // New: needs coordination
  activeEvent: { id: string; name: string; slug: string; description: string | null; region: string; started_at: string } | null;
  needsPoints: {
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
    categoryName: string;
  }[];
  needsSummary: {
    total: number;
    byStatus: { pending: number; verified: number; in_transit: number; completed: number; resolved: number };
    byGap: { lunas: number; sustenance: number; shelter: number };
    byAccess: { truck: number; "4x4": number; boat: number; foot_only: number; cut_off: number };
    critical: number;
  };
};

type CachedDashboard = {
  data: DashboardData;
  updatedAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Drop and recreate on version bump to clear stale data shape
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedDashboard(): Promise<CachedDashboard | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise<CachedDashboard | null>((resolve) => {
      const tx = db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function setCachedDashboard(
  data: CachedDashboard["data"]
): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ data, updatedAt: Date.now() } satisfies CachedDashboard, CACHE_KEY);
  } catch {
    // Cache write failure is non-critical — silently ignore
  } finally {
    db?.close();
  }
}
