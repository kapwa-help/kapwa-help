const DB_NAME = "luaid";
const DB_VERSION = 3;
const STORE_NAME = "dashboard";

const NEEDS_KEY = "needs";
const RELIEF_KEY = "relief";

export type NeedsData = {
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
    createdAt: string;
  }[];
};

export type ReliefData = {
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

// --- Needs cache ---

export function getCachedNeeds(): Promise<CachedEntry<NeedsData> | null> {
  return getCached<NeedsData>(NEEDS_KEY);
}

export function setCachedNeeds(data: NeedsData): Promise<void> {
  return setCached(NEEDS_KEY, data);
}

// --- Relief cache ---

export function getCachedRelief(): Promise<CachedEntry<ReliefData> | null> {
  return getCached<ReliefData>(RELIEF_KEY);
}

export function setCachedRelief(data: ReliefData): Promise<void> {
  return setCached(RELIEF_KEY, data);
}
