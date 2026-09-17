/**
 * Minimal IndexedDB wrapper for user-uploaded sound files.
 *
 * Four operations don't justify pulling in `idb` or `dexie`.
 *
 * Why IndexedDB and not localStorage: these are multi-megabyte binaries that
 * would blow the ~5MB localStorage quota, and a synchronous base64 read would
 * jank the first paint. The split to remember is — localStorage holds anything
 * the first paint depends on; IndexedDB holds everything else.
 */

const DB_NAME = "rkt";
const DB_VERSION = 1;
const STORE = "sounds";

export interface SoundRecord {
  id: string;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    // Private browsing and blocked-storage modes both land here.
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const transaction = db.transaction(STORE, mode);
          const request = run(transaction.objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export function idbPut(record: SoundRecord): Promise<void> {
  return tx("readwrite", (store) => store.put(record) as IDBRequest<IDBValidKey>).then(
    () => undefined,
  );
}

export function idbGet(id: string): Promise<SoundRecord | null> {
  return tx<SoundRecord>("readonly", (store) => store.get(id) as IDBRequest<SoundRecord>);
}

export function idbAll(): Promise<SoundRecord[]> {
  return tx<SoundRecord[]>(
    "readonly",
    (store) => store.getAll() as IDBRequest<SoundRecord[]>,
  ).then((records) => records ?? []);
}

export function idbDelete(id: string): Promise<void> {
  return tx("readwrite", (store) => store.delete(id) as IDBRequest<undefined>).then(
    () => undefined,
  );
}
