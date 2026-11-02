// Optional Origin Private File System helpers for large temporary files. Always feature-detected.
export const opfsSupported = () => typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
const tmpDir = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('tmp', { create: true });

export async function writeTemp(name, blob) {
  if (!opfsSupported()) return false;
  try {
    const fh = await (await tmpDir()).getFileHandle(name, { create: true });
    if (!fh.createWritable) return false; // not available on every browser
    const w = await fh.createWritable(); await w.write(blob); await w.close(); return true;
  } catch { return false; }
}
export async function readTemp(name) {
  try { return await (await (await tmpDir()).getFileHandle(name)).getFile(); } catch { return null; }
}
export async function removeTemp(name) { try { await (await tmpDir()).removeEntry(name); } catch { /* gone */ } }
export async function clearTemp() {
  if (!opfsSupported()) return;
  try { await (await navigator.storage.getDirectory()).removeEntry('tmp', { recursive: true }); } catch { /* none */ }
}
