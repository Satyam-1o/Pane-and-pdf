import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import { Spinner } from './ui';

// One file per tool in src/pages — add a route here and an entry in config/tools.js.
const Home = lazy(() => import('./pages/Home'));
const Library = lazy(() => import('./pages/Library'));
const Viewer = lazy(() => import('./pages/Viewer'));
const ImagesToPdf = lazy(() => import('./pages/ImagesToPdf'));
const PdfToImages = lazy(() => import('./pages/PdfToImages'));
const MergeSplit = lazy(() => import('./pages/MergeSplit'));
const Organize = lazy(() => import('./pages/Organize'));
const Annotate = lazy(() => import('./pages/Annotate'));
const Compress = lazy(() => import('./pages/Compress'));

export default function App() {
  return (
    <Suspense fallback={<div className="p-8"><Spinner /></div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="library" element={<Library />} />
          <Route path="view/:id" element={<Viewer />} />
          <Route path="images-to-pdf" element={<ImagesToPdf />} />
          <Route path="pdf-to-images" element={<PdfToImages />} />
          <Route path="merge-split" element={<MergeSplit />} />
          <Route path="organize/:id?" element={<Organize />} />
          <Route path="annotate/:id?" element={<Annotate />} />
          <Route path="compress" element={<Compress />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
