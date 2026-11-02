// Public storage API used by the rest of the app. Documents live ONLY in this browser.
import { tx, req, StorageError } from './db';
import { LIMITS } from '../../config/app';
import { formatBytes } from '../../lib/format';

const uid = () => crypto.randomUUID();

export async function getUsage() {
  const base = { usage: 0, quota: 0, persisted: false, docCount: 0 };
  try {
    if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); base.usage = e.usage || 0; base.quota = e.quota || 0; }
    if (navigator.storage?.persisted) base.persisted = await navigator.storage.persisted();
    base.docCount = (await listDocuments()).length;
  } catch { /* usage is informational */ }
  return base;
}

export async function requestPersistence() {
  return navigator.storage?.persist ? navigator.storage.persist() : false;
}

export async function checkQuota(bytes) {
  if (!navigator.storage?.estimate) return;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  if (quota && usage + bytes > quota * 0.95) {
    throw new StorageError('quota', `Not enough browser storage for ${formatBytes(bytes)}. Free up space by deleting documents from the Library.`);
  }
}

export async function saveDocument(blob, { name, pageCount = null, origin = 'upload' }) {
  await checkQuota(blob.size * 1.2);
  const now = Date.now();
  const meta = { id: uid(), name, size: blob.size, type: blob.type || 'application/pdf', pageCount, origin, createdAt: now, updatedAt: now };
  await tx(['documents', 'blobs'], 'readwrite', (d, b) => Promise.all([req(d.put(meta)), req(b.put({ id: meta.id, blob }))]));
  return meta;
}

export async function listDocuments() {
  const all = await tx('documents', 'readonly', (d) => req(d.getAll()));
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getDocumentMeta = (id) => tx('documents', 'readonly', (d) => req(d.get(id)));
export async function getDocumentBlob(id) {
  const rec = await tx('blobs', 'readonly', (b) => req(b.get(id)));
  return rec?.blob || null;
}

/** Replace a document's content, keeping the previous version in history. */
export async function replaceDocumentBlob(id, blob, { label = 'Edit', pageCount } = {}) {
  await checkQuota(blob.size * 2.2);
  await tx(['documents', 'blobs', 'history'], 'readwrite', async (d, b, h) => {
    const [meta, old] = await Promise.all([req(d.get(id)), req(b.get(id))]);
    if (!meta || !old) throw new StorageError('missing', 'Document no longer exists.');
    await req(h.put({ id: uid(), docId: id, label, createdAt: Date.now(), size: meta.size, pageCount: meta.pageCount, blob: old.blob }));
    const versions = (await req(h.index('docId').getAll(id))).sort((x, y) => y.createdAt - x.createdAt);
    await Promise.all(versions.slice(LIMITS.maxHistoryPerDoc).map((v) => req(h.delete(v.id))));
    await Promise.all([
      req(d.put({ ...meta, size: blob.size, pageCount: pageCount ?? meta.pageCount, updatedAt: Date.now() })),
      req(b.put({ id, blob })),
    ]);
  });
}

export const listHistory = async (docId) =>
  (await tx('history', 'readonly', (h) => req(h.index('docId').getAll(docId)))).map(({ blob, ...m }) => m).sort((a, b) => b.createdAt - a.createdAt);
export async function getHistoryBlob(historyId) {
  return (await tx('history', 'readonly', (h) => req(h.get(historyId))))?.blob || null;
}

export async function renameDocument(id, name) {
  await tx('documents', 'readwrite', async (d) => { const m = await req(d.get(id)); if (m) await req(d.put({ ...m, name })); });
}

export async function deleteDocument(id) {
  await tx(['documents', 'blobs', 'history', 'prefs'], 'readwrite', async (d, b, h, p) => {
    const versions = await req(h.index('docId').getAllKeys(id));
    await Promise.all([req(d.delete(id)), req(b.delete(id)), req(p.delete(`annot:${id}`)), req(p.delete(`annot-base:${id}`)), ...versions.map((k) => req(h.delete(k)))]);
  });
}

export async function clearAllDocuments() {
  await tx(['documents', 'blobs', 'history', 'prefs'], 'readwrite', (d, b, h, p) => Promise.all([req(d.clear()), req(b.clear()), req(h.clear()), req(p.clear())]));
}

export const getPref = async (key, fallback) => (await tx('prefs', 'readonly', (p) => req(p.get(key))))?.value ?? fallback;
export const setPref = (key, value) => tx('prefs', 'readwrite', (p) => req(p.put({ key, value })));

export const deletePref = (key) => tx('prefs', 'readwrite', (p) => req(p.delete(key)));
