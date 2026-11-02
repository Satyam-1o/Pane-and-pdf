# Pāne&PDF

PDF tools that run entirely in the browser. Files are stored in IndexedDB on the visitor's device; no backend exists.

    npm install
    npm run dev      # local development
    npm run build    # static output in dist/

## Where to change things

| I want to change…                     | Edit                                                     |
|---------------------------------------|----------------------------------------------------------|
| Colors, radius, fonts, dark mode      | `src/styles/theme.css` (tokens only)                     |
| Buttons, cards, dropzone, alerts      | `src/ui/*` (presentation only, no app logic)             |
| Top bar, Tools menu, page frame, footer | `src/layout/*`                                         |
| Home tiles + Tools menu entries       | `src/config/tools.js` (+ route in `src/App.jsx`)         |
| Home screen                           | `src/pages/Home.jsx`                                     |
| App name, privacy text, limits        | `src/config/app.js`                                      |
| One tool's screen                     | `src/pages/<Tool>.jsx`                                   |
| Shared feature widgets                | `src/components/*` (PdfPage, DocPicker, ResultPanel…)    |
| Saving/loading/deleting documents     | `src/services/storage/*` (IndexedDB, Blob URLs, OPFS)    |
| PDF rendering / conversion            | `src/services/pdf/*`                                     |
| PDF editing logic (merge, rotate…)    | `src/workers/pdf.worker.js` + `src/services/pdf/engine.js` |

Layers only depend downward: pages → components/ui → hooks → services → workers. Restyling `ui/` or `theme.css` cannot affect processing or storage.

## Privacy enforcement

`vercel.json` and `public/_headers` set a Content-Security-Policy with `connect-src 'self' blob: data:`, so the browser itself blocks any request to another origin. There are no analytics, fonts or scripts from third parties. Keep it that way, or update the privacy statement in `src/config/app.js`.

## Deploy

Vercel: import the repo (framework: Vite). Cloudflare Pages: build `npm run build`, output `dist`. Both configs are included.
