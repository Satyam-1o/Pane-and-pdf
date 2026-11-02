import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Highlighter, MousePointer2, Pencil, Redo2, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { Alert, Button, Card, Spinner } from '../ui';
import PdfPage from '../components/PdfPage';
import PickDocument from '../components/PickDocument';
import { usePdfDocument, useStoredDocument } from '../hooks/usePdfDocument';
import { useTask } from '../hooks/useTask';
import { pdfOps } from '../services/pdf/engine';
import { checkQuota, getPref, replaceDocumentBlob, setPref } from '../services/storage/storageService';

const SCALE = 1.2;
const TOOLS = [['select', 'Select', MousePointer2], ['text', 'Text', Type], ['highlight', 'Highlight', Highlighter], ['rect', 'Box', Square], ['ink', 'Draw', Pencil]];
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#111827', '#facc15'];

export default function Annotate() {
  const { id } = useParams();
  return id ? <Editor key={id} id={id} /> : <PickDocument title="Annotate" description="Add text, highlights, boxes and drawings." toolPath="/annotate" />;
}

function Editor({ id }) {
  const nav = useNavigate();
  const { meta, blob, error: storeErr } = useStoredDocument(id);
  const [base, setBase] = useState(null); // the PDF WITHOUT our marks; annotations are re-applied to it on every save
  const [items, setItems] = useState([]); // coordinates normalised 0..1 from top-left of the displayed page
  const { pdf, error: pdfErr } = usePdfDocument(base);
  const [page, setPage] = useState(0);
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#e11d48');
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dims, setDims] = useState({ w: 600, h: 800 });
  const svg = useRef(null), drag = useRef(null), nextId = useRef(0);
  const past = useRef([]), future = useRef([]), lastKey = useRef(null);
  const [, bump] = useState(0);
  const { busy, error, run } = useTask();

  useEffect(() => { // load earlier (still editable) annotations for this document
    if (!blob) return undefined;
    let dead = false;
    Promise.all([getPref(`annot-base:${id}`, null), getPref(`annot:${id}`, [])]).then(([b, saved]) => {
      if (dead) return;
      nextId.current = Math.max(0, ...saved.map((i) => i.id || 0));
      setItems(saved); setBase(b || blob);
    });
    return () => { dead = true; };
  }, [blob, id]);

  // ---- undo / redo: call snap() right before a change; same key = one step (e.g. typing) ----
  const snap = (key = null) => {
    if (key && lastKey.current === key) return;
    lastKey.current = key; past.current.push(items); if (past.current.length > 60) past.current.shift();
    future.current = []; bump((n) => n + 1);
  };
  const undo = () => { if (!past.current.length) return; future.current.push(items); setItems(past.current.pop()); lastKey.current = null; setSel(null); setEditing(null); bump((n) => n + 1); };
  const redo = () => { if (!future.current.length) return; past.current.push(items); setItems(future.current.pop()); lastKey.current = null; setSel(null); setEditing(null); bump((n) => n + 1); };

  const patch = (itemId, p) => setItems((c) => c.map((x) => (x.id === itemId ? { ...x, ...p } : x)));
  const remove = (itemId) => { snap(); setItems((c) => c.filter((x) => x.id !== itemId)); setSel(null); setEditing(null); };
  const mine = items.filter((i) => i.page === page);
  const selected = items.find((i) => i.id === sel);
  const editItem = items.find((i) => i.id === editing);
  const goPage = (n) => { setPage(n); setSel(null); setEditing(null); };

  useEffect(() => {
    const onKey = (e) => {
      if (editing || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); remove(sel); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, editing, items]);

  const pt = (e) => { const r = svg.current.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };

  const down = (e) => { // pointer down on empty page
    const [x, y] = pt(e);
    if (tool === 'select') { setSel(null); setEditing(null); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'text') {
      snap();
      const it = { id: ++nextId.current, page, type: 'text', x, y, text: 'Text', size: 14, color };
      setItems((c) => [...c, it]); setSel(it.id); setEditing(it.id); setTool('select'); return;
    }
    setSel(null);
    setDraft(tool === 'ink' ? { page, type: 'ink', color, points: [[x, y]] } : { page, type: tool, color, x, y, w: 0, h: 0, ox: x, oy: y });
  };
  const startDrag = (e, it, mode = 'move') => {
    if (tool !== 'select') return;
    e.stopPropagation(); svg.current.setPointerCapture(e.pointerId);
    setSel(it.id); if (editing !== it.id) setEditing(null);
    drag.current = { id: it.id, mode, start: pt(e), orig: it, snapped: false };
  };
  const move = (e) => {
    const d = drag.current, [x, y] = pt(e);
    if (d) {
      if (!d.snapped) { snap(); d.snapped = true; }
      const dx = x - d.start[0], dy = y - d.start[1], o = d.orig;
      if (d.mode === 'resize') patch(d.id, { w: Math.max(0.01, o.w + dx), h: Math.max(0.01, o.h + dy) });
      else if (o.type === 'ink') patch(d.id, { points: o.points.map(([a, b]) => [a + dx, b + dy]) });
      else patch(d.id, { x: o.x + dx, y: o.y + dy });
      return;
    }
    if (!draft) return;
    setDraft(draft.type === 'ink' ? { ...draft, points: [...draft.points, [x, y]] }
      : { ...draft, x: Math.min(x, draft.ox), y: Math.min(y, draft.oy), w: Math.abs(x - draft.ox), h: Math.abs(y - draft.oy) });
  };
  const up = () => {
    drag.current = null;
    if (draft && (draft.type === 'ink' ? draft.points.length > 1 : draft.w > 0.005)) {
      snap();
      const { ox, oy, ...it } = draft; const n = { ...it, id: ++nextId.current };
      setItems((c) => [...c, n]); setSel(n.id); setTool('select');
    }
    setDraft(null);
  };
  const finishEdit = () => { lastKey.current = null; if (editItem && !editItem.text.trim()) remove(editItem.id); else setEditing(null); };

  const save = () => run(async (p) => {
    if (!(await getPref(`annot-base:${id}`, null))) { await checkQuota(base.size); await setPref(`annot-base:${id}`, base); }
    const out = await pdfOps.annotate(base, items, { onProgress: p });
    await replaceDocumentBlob(id, out, { label: 'Annotations' });
    await setPref(`annot:${id}`, items);
    nav(`/view/${id}`);
  });

  const W = dims.w, H = dims.h;
  const box = (it) => {
    if (it.type === 'text') return { x: it.x * W - 2, y: it.y * H - it.size * SCALE, w: Math.max(24, it.text.length * it.size * SCALE * 0.55) + 4, h: it.size * SCALE * 1.3 };
    if (it.type === 'ink') {
      const xs = it.points.map((q) => q[0] * W), ys = it.points.map((q) => q[1] * H), x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    return { x: it.x * W, y: it.y * H, w: it.w * W, h: it.h * H };
  };
  const visual = (it) => {
    if (it.type === 'text') return <text x={it.x * W} y={it.y * H} fontSize={it.size * SCALE} fill={it.color} fontFamily="Helvetica, Arial, sans-serif" style={{ userSelect: 'none' }}>{it.text}</text>;
    if (it.type === 'ink') return <polyline fill="none" stroke={it.color} strokeWidth={1.8 * SCALE} strokeLinejoin="round" points={it.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')} />;
    return <rect x={it.x * W} y={it.y * H} width={it.w * W} height={it.h * H} fill={it.type === 'highlight' ? it.color : 'none'} fillOpacity={0.35} stroke={it.type === 'rect' ? it.color : 'none'} strokeWidth={1.5 * SCALE} />;
  };
  const shape = (it) => {
    const b = box(it), grab = tool === 'select', on = sel === it.id;
    return (
      <g key={it.id} style={{ pointerEvents: grab ? 'auto' : 'none', cursor: grab ? 'move' : undefined }}
        onPointerDown={(e) => startDrag(e, it)} onDoubleClick={() => it.type === 'text' && setEditing(it.id)}>
        <rect x={b.x} y={b.y} width={Math.max(b.w, 8)} height={Math.max(b.h, 8)} fill="transparent" />
        {editing !== it.id && visual(it)}
        {on && <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} fill="none" stroke="#2563eb" strokeDasharray="4 3" />}
        {on && (it.type === 'rect' || it.type === 'highlight') && (
          <circle cx={b.x + b.w} cy={b.y + b.h} r={6} fill="#2563eb" style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => startDrag(e, it, 'resize')} />
        )}
      </g>
    );
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-ui border border-line bg-surface px-4 py-3">
        <Link to="/library" aria-label="Back to library"><Button size="icon"><ArrowLeft size={16} /></Button></Link>
        <div className="min-w-0 truncate font-semibold" title={meta?.name}>{meta?.name || 'Annotate'}</div>
        <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs text-brand">Saved on this device</span>
        <span className="flex-1" />
        <Button disabled={!past.current.length} onClick={undo}><Undo2 size={14} /> Undo</Button>
        <Button disabled={!future.current.length} onClick={redo}><Redo2 size={14} /> Redo</Button>
        <Button variant="primary" disabled={busy || !base || (!items.length && base === blob)} onClick={save}>{busy && <Spinner />} Save annotations</Button>
      </div>
      {(storeErr || pdfErr) && <Alert>{(storeErr || pdfErr).message}</Alert>}
      {error && <Alert>{error}</Alert>}
      {pdf && (
        <div className="grid overflow-hidden rounded-ui border border-line bg-surface-2 lg:grid-cols-[68px_132px_minmax(0,1fr)_280px]">
          <nav aria-label="Tools" className="flex gap-2 border-b border-line bg-surface p-2 lg:flex-col lg:items-center lg:border-b-0 lg:border-r">
            {TOOLS.map(([k, label, Icon]) => (
              <button key={k} type="button" title={label} aria-label={label} aria-pressed={tool === k} onClick={() => setTool(k)}
                className={`flex h-11 w-11 items-center justify-center rounded-ui ${tool === k ? 'bg-brand text-brand-fg' : 'text-fg hover:bg-surface-2'}`}><Icon size={20} /></button>
            ))}
          </nav>
          <aside aria-label="Pages" className="hidden max-h-[780px] flex-col items-center gap-3 overflow-y-auto border-r border-line p-3 lg:flex">
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <button key={i} type="button" aria-label={`Page ${i + 1}`} onClick={() => goPage(i)} className="flex flex-col items-center gap-1">
                <div className={`overflow-hidden rounded border-2 ${i === page ? 'border-brand' : 'border-line'}`}><PdfPage pdf={pdf} pageNumber={i + 1} scale={0.15} /></div>
                <span className="text-xs text-muted">{i + 1}</span>
              </button>
            ))}
          </aside>
          <div className="flex justify-center overflow-auto p-6">
            <PdfPage key={page} pdf={pdf} pageNumber={page + 1} scale={SCALE} eager onRendered={(r) => setDims({ w: r.width, h: r.height })}>
              <svg ref={svg} width={W} height={H} className="absolute inset-0 touch-none" style={{ cursor: tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair' }}
                onPointerDown={down} onPointerMove={move} onPointerUp={up}>
                {mine.map(shape)}{draft && visual(draft)}
              </svg>
              {editItem && editItem.page === page && (
                <input autoFocus value={editItem.text} onFocus={(e) => e.target.select()} onChange={(e) => { snap(`${editItem.id}:text`); patch(editItem.id, { text: e.target.value }); }}
                  onBlur={finishEdit} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                  className="absolute border border-brand bg-white/90 px-0.5 outline-none"
                  style={{ left: editItem.x * W - 2, top: editItem.y * H - editItem.size * SCALE, fontSize: editItem.size * SCALE, lineHeight: 1.25, color: editItem.color, fontFamily: 'Helvetica, Arial, sans-serif', width: Math.max(80, editItem.text.length * editItem.size * SCALE * 0.6 + 16) }} />
              )}
            </PdfPage>
          </div>
          <aside aria-label="Selected item" className="space-y-4 border-t border-line bg-surface p-5 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <Button size="icon" disabled={page === 0} aria-label="Previous page" onClick={() => goPage(page - 1)}><ChevronLeft size={16} /></Button>
              <span className="text-sm">Page {page + 1} / {pdf.numPages}</span>
              <Button size="icon" disabled={page >= pdf.numPages - 1} aria-label="Next page" onClick={() => goPage(page + 1)}><ChevronRight size={16} /></Button>
            </div>
            <h2 className="font-display text-lg font-bold capitalize">{selected ? (selected.type === 'rect' ? 'Box' : selected.type) : 'Color'}</h2>
            <div className="flex gap-2.5">{COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => { setColor(c); if (selected) { snap(); patch(selected.id, { color: c }); } }}
                className={`h-7 w-7 rounded-full border-[3px] ${(selected ? selected.color : color) === c ? 'border-fg' : 'border-surface ring-1 ring-line'}`} style={{ background: c }} />))}</div>
            {selected?.type === 'text' && (
              <>
                <label className="block text-sm font-medium">Wording
                  <input value={selected.text} onChange={(e) => { snap(`${selected.id}:text`); patch(selected.id, { text: e.target.value }); }} className="mt-1.5 w-full rounded-ui border border-line bg-surface px-2.5 py-2 text-sm font-normal" /></label>
                <label className="block text-sm font-medium">Size
                  <input type="number" min="6" max="96" value={selected.size} onChange={(e) => { snap(`${selected.id}:size`); patch(selected.id, { size: Math.min(96, Math.max(6, +e.target.value || 14)) }); }} className="mt-1.5 block w-24 rounded-ui border border-line bg-surface px-2.5 py-2 text-sm font-normal" /></label>
              </>
            )}
            {selected
              ? <Button variant="danger" className="w-full" onClick={() => remove(selected.id)}><Trash2 size={14} /> Delete</Button>
              : <p className="text-sm text-muted">Pick Text and click the page, or Draw and drag. Use Select to move or edit what you've added.</p>}
            <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">Double-click text on the page to edit it. Ctrl+Z undoes, Delete removes. Marks stay editable after you save.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
