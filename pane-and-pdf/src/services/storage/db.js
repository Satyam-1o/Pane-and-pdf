// Low-level IndexedDB access. Stores: documents (metadata), blobs (file data), history (previous versions), prefs.
const DB_NAME = 'pane-and-pdf';
const DB_VERSION = 1;

export class StorageError extends Error {
  constructor(code, message, cause) { super(message); this.code = code; this.cause = cause; }
}

let dbPromise = null;
export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new StorageError('unavailable', 'Browser storage is unavailable (private mode or blocked by settings).'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('documents', { keyPath: 'id' });
      db.createObjectStore('blobs', { keyPath: 'id' });
      db.createObjectStore('history', { keyPath: 'id' }).createIndex('docId', 'docId');
      db.createObjectStore('prefs', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new StorageError('unavailable', 'Could not open browser storage.', req.error));
    req.onblocked = () => reject(new StorageError('unavailable', 'Browser storage is blocked by another tab.'));
  }).catch((e) => { dbPromise = null; throw e; });
  return dbPromise;
}

function wrap(err) {
  if (err instanceof StorageError) return err;
  if (err?.name === 'QuotaExceededError') return new StorageError('quota', 'Browser storage is full. Delete some documents and try again.', err);
  return new StorageError('failed', 'A storage operation failed.', err);
}

export const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** Run fn(...stores) inside one transaction; resolves after the transaction commits. */
export async function tx(storeNames, mode, fn) {
  const db = await openDB();
  const names = [].concat(storeNames);
  return new Promise((resolve, reject) => {
    let out;
    let t;
    try { t = db.transaction(names, mode); } catch (e) { return reject(wrap(e)); }
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(wrap(t.error));
    t.onabort = () => reject(wrap(t.error));
    Promise.resolve()
      .then(() => fn(...names.map((n) => t.objectStore(n))))
      .then((v) => { out = v; })
      .catch((e) => { try { t.abort(); } catch { /* already finished */ } reject(wrap(e)); });
  });
}
