export function formatBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB']; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}
export const baseName = (name = '') => name.replace(/\.[^.]+$/, '');
export const pdfName = (name) => `${baseName(name)}.pdf`;
export const formatDate = (ts) => new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const errMsg = (e) => e?.message || 'Something went wrong.';
