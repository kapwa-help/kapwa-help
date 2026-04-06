const DB_NAME = "luaid";
const DB_VERSION = 4;
const STORE_NAME = "dashboard";

const NEEDS_KEY = "needs";
const DEPLOYMENTS_KEY = "deployments";
const OPERATIONS_KEY = "operations";

export type NeedsData = {
  activeEvent: { id: string; name: string; slug: string; description: string | null; region: string; started_at: string } | null;
  needsPoints: {
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
  }[];
};

export type BarangayDeployment = {
  orgName: string;
  categoryName: string;
  categoryIcon: string | null;
  quantity: number | null;
  unit: string | null;
  date: string | null;
};

export type BarangayDistributionEntry = {
  id: string;
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  categories: { name: string; icon: string | null; total: number }[];
  totalQuantity: number;
  deployments: BarangayDeployment[];
};

export type RecentDeploymentEntry = {
  id: string;
  quantity: number | null;
  unit: string | null;
  date: string | null;
  orgName: string;
  categoryName: string;
  categoryIcon: string | null;
  barangayName: string;
  municipality: string;
};

export type DeploymentsData = {
  peopleServed: { adults: number; children: number; seniorsPwd: number };
  barangayDistribution: BarangayDistributionEntry[];
  recentDeployments: RecentDeploymentEntry[];
};

export type OperationsData = {
  totalDonations: number;
  totalSpent: number;
  donationsByOrg: { name: string; amount: number }[];
  recentPurchases: {
    id: string;
    quantity: number;
    unit: string | null;
    cost: number | null;
    date: string | null;
    orgName: string;
    categoryName: string;
    categoryIcon: string | null;
  }[];
  availableInventory: {
    name: string;
    icon: string | null;
    purchased: number;
    deployed: number;
    available: number;
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

// --- Deployments cache ---

export function getCachedDeployments(): Promise<CachedEntry<DeploymentsData> | null> {
  return getCached<DeploymentsData>(DEPLOYMENTS_KEY);
}

export function setCachedDeployments(data: DeploymentsData): Promise<void> {
  return setCached(DEPLOYMENTS_KEY, data);
}

// --- Operations cache ---

export function getCachedOperations(): Promise<CachedEntry<OperationsData> | null> {
  return getCached<OperationsData>(OPERATIONS_KEY);
}

export function setCachedOperations(data: OperationsData): Promise<void> {
  return setCached(OPERATIONS_KEY, data);
}
