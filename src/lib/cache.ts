const DB_NAME = "luaid";
const DB_VERSION = 6;
const STORE_NAME = "dashboard";

const RELIEF_MAP_KEY = "reliefMap";
const TRANSPARENCY_KEY = "transparency";

export type ReliefMapData = {
  activeEvent: { id: string; name: string; slug: string; description: string | null; region: string; started_at: string } | null;
  needsPoints: {
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
  }[];
  hubs: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    description: string | null;
    notes: string | null;
    inventory: { categoryName: string; categoryIcon: string }[];
  }[];
  hazards: {
    id: string;
    description: string;
    photoUrl: string | null;
    lat: number;
    lng: number;
    status: string;
    reportedBy: string | null;
    createdAt: string;
  }[];
};

export type TransparencyData = {
  totalDonations: number;
  totalSpent: number;
  totalBeneficiaries: number;
  donationsByOrg: { name: string; amount: number }[];
  recentPurchases: {
    id: string;
    cost: number | null;
    date: string | null;
    orgName: string;
    categories: { name: string; icon: string }[];
  }[];
};

type CachedEntry<T> = {
  data: T;
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

// --- Generic helpers ---

async function getCached<T>(key: string): Promise<CachedEntry<T> | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise<CachedEntry<T> | null>((resolve) => {
      const tx = db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

async function setCached<T>(key: string, data: T): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ data, updatedAt: Date.now() } satisfies CachedEntry<T>, key);
  } catch {
    // Cache write failure is non-critical — silently ignore
  } finally {
    db?.close();
  }
}

// --- Relief Map cache ---

export function getCachedReliefMap(): Promise<CachedEntry<ReliefMapData> | null> {
  return getCached<ReliefMapData>(RELIEF_MAP_KEY);
}

export function setCachedReliefMap(data: ReliefMapData): Promise<void> {
  return setCached(RELIEF_MAP_KEY, data);
}

// --- Transparency cache ---

export function getCachedTransparency(): Promise<CachedEntry<TransparencyData> | null> {
  return getCached<TransparencyData>(TRANSPARENCY_KEY);
}

export function setCachedTransparency(data: TransparencyData): Promise<void> {
  return setCached(TRANSPARENCY_KEY, data);
}
