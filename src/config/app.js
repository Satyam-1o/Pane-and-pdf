export const APP_NAME = 'Pāne&PDF';
export const TAGLINE = 'PDF tools that never leave your browser';
// Only show this while it is true: no network calls carry document data (enforced by CSP in vercel.json / public/_headers).
export const PRIVACY_STATEMENT =
  'Your documents are processed locally in your browser. Pāne&PDF does not upload your PDF files to its servers.';
export const LIMITS = { warnFileMB: 150, maxHistoryPerDoc: 5 };
