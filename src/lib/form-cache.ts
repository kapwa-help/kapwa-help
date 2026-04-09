import type { NeedInsert, DonationInsert, PurchaseInsert, HazardInsert } from "@/lib/queries";

const DB_NAME = "luaid-forms";
const DB_VERSION = 3;
const OPTIONS_STORE = "options";
const OUTBOX_STORE = "outbox";

type CachedOptions<T> = {
  data: T[];
  updatedAt: number;
};

type OutboxEntry =
  | { type: "need"; payload: NeedInsert; createdAt: number }
  | { type: "donation"; payload: DonationInsert; createdAt: number }
  | { type: "purchase"; payload: PurchaseInsert; createdAt: number }
  | { type: "hazard"; payload: HazardInsert; photo?: Blob; createdAt: number };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPTIONS_STORE)) {
        db.createObjectStore(OPTIONS_STORE);
      }
      // Recreate outbox on version bump to clear stale payload shapes
      if (db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.deleteObjectStore(OUTBOX_STORE);
      }
      db.createObjectStore(OUTBOX_STORE, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Dropdown cache ---

export async function getCachedOptions<T>(
  key: string
): Promise<CachedOptions<T> | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise<CachedOptions<T> | null>((resolve) => {
      const tx = db!.transaction(OPTIONS_STORE, "readonly");
      const store = tx.objectStore(OPTIONS_STORE);
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

export async function setCachedOptions<T>(
  key: string,
  data: T[]
): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction(OPTIONS_STORE, "readwrite");
    const store = tx.objectStore(OPTIONS_STORE);
    store.put(
      { data, updatedAt: Date.now() } satisfies CachedOptions<T>,
      key
    );
  } catch {
    // Cache write failure is non-critical — silently ignore
  } finally {
    db?.close();
  }
}

// --- Outbox ---

export async function addToOutbox(entry: Omit<OutboxEntry, "createdAt">): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    store.add({ ...entry, createdAt: Date.now() });
  } finally {
    db?.close();
  }
}

export async function getOutboxEntries(): Promise<
  { key: IDBValidKey; entry: OutboxEntry }[]
> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise<{ key: IDBValidKey; entry: OutboxEntry }[]>(
      (resolve) => {
        const tx = db!.transaction(OUTBOX_STORE, "readonly");
        const store = tx.objectStore(OUTBOX_STORE);
        const request = store.openCursor();
        const entries: { key: IDBValidKey; entry: OutboxEntry }[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            entries.push({ key: cursor.key, entry: cursor.value as OutboxEntry });
            cursor.continue();
          } else {
            resolve(entries);
          }
        };
        request.onerror = () => resolve([]);
      }
    );
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

export async function removeFromOutbox(key: IDBValidKey): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    store.delete(key);
  } catch {
    // Outbox delete failure is non-critical — silently ignore
  } finally {
    db?.close();
  }
}

export async function getOutboxCount(): Promise<number> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise<number>((resolve) => {
      const tx = db!.transaction(OUTBOX_STORE, "readonly");
      const store = tx.objectStore(OUTBOX_STORE);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  } finally {
    db?.close();
  }
}
