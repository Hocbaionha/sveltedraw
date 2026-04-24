// IndexedDB helpers for image binary persistence.
//
// localStorage has a ~5-10 MB quota and stores strings — fine for the scene
// JSON but punitive for image dataURLs. IndexedDB has a much larger quota
// (often 50%+ of free disk) and handles blobs natively.
//
// Schema: one object store "files", keyed by FileId. Value shape is whatever
// the caller writes (typically `{ id, mimeType, dataURL, created }`).
//
// KNOWN LIMITATION: each call opens a fresh DB connection — no caching.
// Acceptable for the current PoC; revisit if image-heavy scenes show overhead.

const DB_NAME = "sveltedraw";
const STORE = "files";
const VERSION = 1;

export const openIdb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const idbPut = async (record: any): Promise<void> => {
  try {
    const db = await openIdb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("sveltedraw: idb put failed", err);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const idbGet = async (id: string): Promise<any | null> => {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};
