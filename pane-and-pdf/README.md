# Pāne&PDF

Private PDF tools that run entirely in your browser.

Merge, split, annotate, reorganize, compress and convert PDFs without uploading anything. Files are processed on your device and stored in your browser, and no backend exists.

> **Live site:** _add your Vercel / Cloudflare Pages URL here_

## Features

| Tool | What it does |
|---|---|
| **Library** | Stores PDFs in your browser (IndexedDB). They are still there after a refresh. Shows storage use and lets you delete files or clear everything. |
| **Viewer** | Scrollable preview with zoom. Pages render only when they come into view. |
| **Images to PDF** | Combine JPG, PNG, WebP and other images into one PDF. Reorder them, and choose A4 or match-the-image page size. |
| **PDF to Images** | Render every page to PNG or JPG at 96, 150 or 300 dpi. Multi-page results download as a ZIP. |
| **Merge & Split** | Merge in a chosen order. Split into single pages or by ranges such as `1-3, 5, 7-9`. |
| **Organize pages** | Drag to reorder, rotate, delete and duplicate pages. Save as a copy or over the original. |
| **Annotate** | Add text, highlights, boxes and drawings. Move, resize and edit them, with undo and redo. Marks stay editable after saving. |
| **Compress** | Optimize the structure (lossless), or reduce quality by turning pages into compressed images. |

Every result can be downloaded, and is also saved to the Library. Saving over an original keeps its last 5 versions in history.

## Privacy

> Your documents are processed locally in your browser. Pāne&PDF does not upload your PDF files to its servers.

This is enforced, not only promised:

- There is no application backend, database or file-upload endpoint.
- `vercel.json` and `public/_headers` set a Content-Security-Policy with `connect-src 'self' blob: data:`. The browser blocks any request to another site.
- No analytics. Fonts are bundled with the app and PDF.js is served from the same origin.
- PDF binaries are never put in `localStorage`. They are stored in IndexedDB only.

If you add analytics or any external service, update the CSP and the privacy statement in `src/config/app.js`. The statement is only true while the app really sends no document data anywhere.

## Tech stack

React 18 · Vite · JavaScript · Tailwind CSS · React Router · Lucide React · PDF.js (rendering) · pdf-lib (editing, in a Web Worker) · Canvas API (images) · IndexedDB (storage) · OPFS helpers (optional temp files) · JSZip (multi-file downloads)

## Getting started

You need **Node.js 18 or newer**.

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # static site in dist/
npm run preview    # serve the production build locally
```

Commit `package-lock.json` after your first install so every deploy uses the same versions.

## Project structure

```
src/
  config/       App name, privacy text, limits (app.js) · Home tiles and Tools menu (tools.js)
  styles/       theme.css: all colors, radius and fonts as design tokens
  ui/           Buttons, cards, dropzone, alerts. Presentation only, no app logic
  layout/       Top bar, Tools menu, page frame, privacy footer
  components/   Shared pieces: PdfPage, DocPicker, DocThumb, ResultPanel, StoragePanel
  pages/        One file per screen: Home, Library, Viewer, ImagesToPdf, PdfToImages,
                MergeSplit, Organize, Annotate, Compress
  hooks/        useLibrary, usePdfDocument, useTask
  services/
    storage/    IndexedDB, Blob URL tracking, OPFS helpers, quota checks
    pdf/        PDF.js loading and rendering, image helpers, worker client (engine.js)
  workers/      pdf.worker.js: merge, split, organize, annotate, optimize
  lib/          Formatting, page-range parsing, downloads
```

Layers depend only downward: pages → components and ui → hooks → services → workers. Restyling `ui/` or `theme.css` cannot affect processing or storage.

## Customizing

| I want to change… | Edit |
|---|---|
| Colors, radius, fonts, dark mode | `src/styles/theme.css` |
| Buttons, cards, dropzone, alerts | `src/ui/*` |
| Top bar, Tools menu, footer | `src/layout/*` |
| Home tiles and Tools menu entries | `src/config/tools.js` (add the route in `src/App.jsx`) |
| Home screen | `src/pages/Home.jsx` |
| App name, privacy text, limits | `src/config/app.js` (also the `<title>` in `index.html`) |
| One tool's screen | `src/pages/<Tool>.jsx` |
| Saving, loading, deleting documents | `src/services/storage/*` |
| PDF editing logic | `src/workers/pdf.worker.js` and `src/services/pdf/engine.js` |

## Deploy

The app is a static site. It needs no server.

**Vercel:** import the repository, keep the Vite preset, deploy. `vercel.json` adds page routing and the security headers.

**Cloudflare Pages:** build command `npm run build`, output directory `dist`. `public/_headers` adds the security headers, and page routing works by default.

After deploying, open the browser's Network tab, use a few tools, and confirm only requests to your own site appear.

## Limitations

- **Storage is per browser.** Clearing site data, or the browser evicting it when disk space is low, removes your files. The Library has a "Keep my files" button that asks the browser for persistent storage.
- **Large files.** Files over 150 MB are rejected on import, and very large PDFs may run out of memory on low-end devices. The app shows an error rather than crashing.
- **Password-protected PDFs** are not supported. Remove the password first.
- **Compress, "Reduce quality" mode** turns pages into images, so text can no longer be selected or searched.
- **Annotations** are added on top of the page. This is not editing of the PDF's original text, which PDFs do not store in an editable way.
- **Changing page order** with Organize discards the editable annotations (the marks already saved in the PDF stay).
- **Private browsing** may block or limit IndexedDB. The app shows a clear message when storage is unavailable.
- OPFS is included as an optional helper for temporary files. It is not used during processing yet.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Browser storage is unavailable" | Leave private mode, or allow site data for the site. |
| "Browser storage is full" | Delete documents in the Library, or use "Clear all documents". |
| "This file is corrupted or not a valid PDF" | The file can't be read. Try re-exporting it from the original program. |
| Blank page after deploy | Make sure the build output is `dist` and the SPA rewrite is active (included for Vercel and Cloudflare Pages). |
| Worker crashed message | The file is likely too large for this device. Try a smaller file, or split it first. |

## Browser support

Current versions of Chrome, Edge, Firefox and Safari. The app needs IndexedDB, Web Workers and Canvas.

## License


