import { FolderOpen, ImagePlus, Image, Layers, LayoutGrid, Minimize2, Pencil, Scissors } from 'lucide-react';
// Single source for the Home tiles and the "Tools" menu. Routes live in src/App.jsx.
export const TOOLS = [
  { to: '/annotate', title: 'Annotate', desc: 'Add text, highlights and drawings you can keep editing.', icon: Pencil },
  { to: '/merge-split', title: 'Merge PDFs', desc: 'Combine files in the order you choose.', icon: Layers },
  { to: '/merge-split?tab=split', title: 'Split a PDF', desc: 'One file per page, or by page ranges.', icon: Scissors },
  { to: '/organize', title: 'Organize pages', desc: 'Reorder, rotate, delete and duplicate.', icon: LayoutGrid },
  { to: '/compress', title: 'Compress', desc: 'Make a smaller copy and keep the original.', icon: Minimize2 },
  { to: '/images-to-pdf', title: 'Images to PDF', desc: 'Turn photos and scans into one document.', icon: ImagePlus },
  { to: '/pdf-to-images', title: 'PDF to images', desc: 'Save every page as PNG or JPG.', icon: Image },
  { to: '/library', title: 'Open library', desc: 'Everything you have saved in this browser.', icon: FolderOpen },
];
