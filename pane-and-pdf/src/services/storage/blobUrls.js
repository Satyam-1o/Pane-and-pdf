// Tracks every Blob URL so none leak. Group by owner (e.g. a page) and revoke when it unmounts.
const owners = new Map();
export function createUrl(blob, owner = 'global') {
  const url = URL.createObjectURL(blob);
  if (!owners.has(owner)) owners.set(owner, new Set());
  owners.get(owner).add(url);
  return url;
}
export function revokeUrl(url) { URL.revokeObjectURL(url); owners.forEach((s) => s.delete(url)); }
export function revokeOwner(owner) { owners.get(owner)?.forEach((u) => URL.revokeObjectURL(u)); owners.delete(owner); }
export function revokeAll() { owners.forEach((s) => s.forEach((u) => URL.revokeObjectURL(u))); owners.clear(); }
