import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, ChevronLeft, ChevronRight, Highlighter, Italic, MousePointer2, Pencil, Redo2, Square, TextCursorInput, Trash2, Type, Undo2 } from 'lucide-react';
import { Alert, Button, Card, Spinner } from '../ui';
import PdfPage from '../components/PdfPage';
import PickDocument from '../components/PickDocument';
import { usePdfDocument, useStoredDocument } from '../hooks/usePdfDocument';
import { useTask } from '../hooks/useTask';
import { pdfOps } from '../services/pdf/engine';
import { getTextRuns } from '../services/pdf/textRuns';
import { sampleBoxColors } from '../lib/canvasSample';
import { checkQuota, getPref, replaceDocumentBlob, setPref } from '../services/storage/storageService';

const SCALE = 1.2;
const TOOLS = [['select', 'Select', MousePointer2], ['edittext', 'Edit existing text', TextCursorInput], ['text', 'Add text', Type], ['highlight', 'Highlight', Highlighter], ['rect', 'Box', Square], ['ink', 'Draw', Pencil]];
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#111827', '#facc15'];
const CSS_FAMILY = { sans: 'Helvetica, Arial, sans-serif', serif: '"Times New Roman", Times, serif', mono: '"Courier New", Courier, monospace' };
const SAFE = /^[\u0020-\u007E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u2022\u20AC]*$/; // what the built-in PDF fonts can draw

export default function Annotate() {
  const { id } = useParams();
  return id ? <Editor key={id} id={id} /> : <PickDocument title="Annotate" description="Edit existing text, add text, highlights, boxes and drawings." toolPath="/annotate" />;
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
  const [runs, setRuns] = useState([]);       // detected text on the current page
  const [rendered, setRendered] = useState(-1);
  const [hover, setHover] = useState(null);
  const svg = useRef(null), drag = useRef(null), nextId = useRef(0), canvasEl = useRef(null);
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

  useEffect(() => { // find existing text once the page is drawn (fonts are known by then)
    if (!pdf || rendered !== page) return undefined;
    let dead = false;
    getTextRuns(pdf, page + 1, SCALE).then((r) => !dead && setRuns(r)).catch(() => !dead && setRuns([]));
    return () => { dead = true; };
  }, [pdf, page, rendered]);

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
  const textual = selected && (selected.type === 'text' || selected.type === 'edit');
  const goPage = (n) => { setPage(n); setSel(null); setEditing(null); setRuns([]); setRendered(-1); };
  const setField = (k, v, key = null) => { snap(key ? `${sel}:${k}` : null); patch(sel, { [k]: v }); };

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

  // click on a detected line of existing text -> cover it with the page background and let the user retype it
  const startEdit = (r) => {
    const existing = items.find((i) => i.type === 'edit' && i.runKey === r.key);
    if (existing) { setSel(existing.id); setEditing(existing.id); return; }
    const { bg, fg } = sampleBoxColors(canvasEl.current, { x: r.x * dims.w, y: r.y * dims.h, w: r.w * dims.w, h: r.h * dims.h });
    snap();
    const it = { id: ++nextId.current, page, type: 'edit', runKey: r.key, orig: r.str, text: r.str, x: r.x, y: r.y, w: r.w, h: r.h, by: r.by, size: r.size, color: fg, bg, family: r.family, bold: r.bold, italic: r.italic, align: 'left' };
    setItems((c) => [...c, it]); setSel(it.id); setEditing(it.id);
  };

  const down = (e) => { // pointer down on empty page
    const [x, y] = pt(e);
    if (tool === 'select' || tool === 'edittext') { setSel(null); setEditing(null); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'text') {
      snap();
      const it = { id: ++nextId.current, page, type: 'text', x, y, text: 'Text', size: 14, color, family: 'sans', bold: false, italic: false };
      setItems((c) => [...c, it]); setSel(it.id); setEditing(it.id); setTool('select'); return;
    }
    setSel(null);
    setDraft(tool === 'ink' ? { page, type: 'ink', color, points: [[x, y]] } : { page, type: tool, color, x, y, w: 0, h: 0, ox: x, oy: y });
  };
  const startDrag = (e, it, mode = 'move') => {
    if (tool !== 'select') return;
    e.stopPropagation(); setSel(it.id); if (editing !== it.id) setEditing(null);
    if (it.type === 'edit') return; // edited text stays over the original; it is not moved
    svg.current.setPointerCapture(e.pointerId);
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
  const finishEdit = () => { lastKey.current = null; if (editItem?.type === 'text' && !editItem.text.trim()) remove(editItem.id); else setEditing(null); };

  const save = () => run(async (p) => {
    const bad = items.find((i) => i.text && !SAFE.test(i.text));
    if (bad) throw new Error(`"${bad.text.slice(0, 30)}" has characters the built-in fonts can't draw. Use Latin letters, digits and common punctuation.`);
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
  const tp = (it) => ({ fontSize: it.size * SCALE, fill: it.color, fontFamily: CSS_FAMILY[it.family || 'sans'], fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? 'italic' : 'normal' });
  const visual = (it, hideText) => {
    if (it.type === 'edit') {
      const ax = it.align === 'center' ? (it.x + it.w / 2) * W : it.align === 'right' ? (it.x + it.w) * W : it.x * W;
      return (<>
        <rect x={it.x * W} y={it.y * H} width={it.w * W} height={it.h * H} fill={it.bg} />
        {!hideText && it.text && <text x={ax} y={it.by * H} textAnchor={it.align === 'center' ? 'middle' : it.align === 'right' ? 'end' : 'start'} {...tp(it)} style={{ userSelect: 'none' }}>{it.text}</text>}
      </>);
    }
    if (it.type === 'text') return hideText ? null : <text x={it.x * W} y={it.y * H} {...tp(it)} style={{ userSelect: 'none' }}>{it.text}</text>;
    if (it.type === 'ink') return <polyline fill="none" stroke={it.color} strokeWidth={1.8 * SCALE} strokeLinejoin="round" points={it.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')} />;
    return <rect x={it.x * W} y={it.y * H} width={it.w * W} height={it.h * H} fill={it.type === 'highlight' ? it.color : 'none'} fillOpacity={0.35} stroke={it.type === 'rect' ? it.color : 'none'} strokeWidth={1.5 * SCALE} />;
  };
  const shape = (it) => {
    const b = box(it), grab = tool === 'select', on = sel === it.id;
    return (
      <g key={it.id} style={{ pointerEvents: grab ? 'auto' : 'none', cursor: grab ? (it.type === 'edit' ? 'pointer' : 'move') : undefined }}
        onPointerDown={(e) => startDrag(e, it)} onDoubleClick={() => (it.type === 'text' || it.type === 'edit') && setEditing(it.id)}>
        <rect x={b.x} y={b.y} width={Math.max(b.w, 8)} height={Math.max(b.h, 8)} fill="transparent" />
        {visual(it, editing === it.id)}
        {on && <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} fill="none" stroke="#2563eb" strokeDasharray="4 3" />}
        {on && (it.type === 'rect' || it.type === 'highlight') && (
          <circle cx={b.x + b.w} cy={b.y + b.h} r={6} fill="#2563eb" style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => startDrag(e, it, 'resize')} />
        )}
      </g>
    );
  };
  const inputStyle = (it) => {
    const fs = it.size * SCALE, isEdit = it.type === 'edit';
    return { left: it.x * W - 2, top: isEdit ? it.by * H - fs * 0.98 - 1 : it.y * H - fs, fontSize: fs, lineHeight: 1.25, color: it.color, fontFamily: CSS_FAMILY[it.family || 'sans'], fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? 'italic' : 'normal', textAlign: it.align || 'left',
      background: isEdit ? it.bg : 'rgba(255,255,255,.9)', width: Math.max(80, isEdit ? it.w * W : 0, it.text.length * fs * 0.6 + 16) };
  };
  const fieldCls = 'mt-1.5 block rounded-ui border border-line bg-surface px-2.5 py-2 text-sm font-normal';

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-ui border border-line bg-surface px-4 py-3">
        <Link to="/library" aria-label="Back to library"><Button size="icon"><ArrowLeft size={16} /></Button></Link>
        <div className="min-w-0 truncate font-semibold" title={meta?.name}>{meta?.name || 'Annotate'}</div>
        <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs text-brand">Saved on this device</span>
        <span className="flex-1" />
        <Button disabled={!past.current.length} onClick={undo}><Undo2 size={14} /> Undo</Button>
        <Button disabled={!future.current.length} onClick={redo}><Redo2 size={14} /> Redo</Button>
        <Button variant="primary" disabled={busy || !base || (!items.length && base === blob)} onClick={save}>{busy && <Spinner />} Save changes</Button>
      </div>
      {(storeErr || pdfErr) && <Alert>{(storeErr || pdfErr).message}</Alert>}
      {error && <Alert>{error}</Alert>}
      {tool === 'edittext' && rendered === page && !runs.length && <Alert tone="info">No editable text found on this page. It may be a scanned image, a rotated page, or text drawn as shapes.</Alert>}
      {pdf && (
        <div className="grid overflow-hidden rounded-ui border border-line bg-surface-2 lg:grid-cols-[68px_132px_minmax(0,1fr)_300px]">
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
            <PdfPage key={page} pdf={pdf} pageNumber={page + 1} scale={SCALE} eager onRendered={(r) => { canvasEl.current = r.canvas; setDims({ w: r.width, h: r.height }); setRendered(page); }}>
              <svg ref={svg} width={W} height={H} className="absolute inset-0 touch-none" style={{ cursor: tool === 'select' ? 'default' : tool === 'edittext' || tool === 'text' ? 'text' : 'crosshair' }}
                onPointerDown={down} onPointerMove={move} onPointerUp={up}>
                {mine.map(shape)}
                {tool === 'edittext' && runs.map((r) => (
                  <rect key={r.key} x={r.x * W} y={r.y * H} width={r.w * W} height={r.h * H} fill="transparent" stroke="#2563eb" strokeWidth={1} strokeOpacity={hover === r.key ? 1 : 0.3}
                    style={{ cursor: 'text' }} onPointerEnter={() => setHover(r.key)} onPointerLeave={() => setHover(null)} onPointerDown={(e) => { e.stopPropagation(); startEdit(r); }} />
                ))}
                {draft && visual(draft)}
              </svg>
              {editItem && editItem.page === page && (
                <input autoFocus value={editItem.text} onFocus={(e) => e.target.select()} onChange={(e) => { snap(`${editItem.id}:text`); patch(editItem.id, { text: e.target.value }); }}
                  onBlur={finishEdit} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                  className="absolute border border-brand px-0.5 outline-none" style={inputStyle(editItem)} />
              )}
            </PdfPage>
          </div>
          <aside aria-label="Selected item" className="space-y-4 border-t border-line bg-surface p-5 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <Button size="icon" disabled={page === 0} aria-label="Previous page" onClick={() => goPage(page - 1)}><ChevronLeft size={16} /></Button>
              <span className="text-sm">Page {page + 1} / {pdf.numPages}</span>
              <Button size="icon" disabled={page >= pdf.numPages - 1} aria-label="Next page" onClick={() => goPage(page + 1)}><ChevronRight size={16} /></Button>
            </div>
            <h2 className="font-display text-lg font-bold">{selected ? { edit: 'Edited text', text: 'Text', rect: 'Box', highlight: 'Highlight', ink: 'Drawing' }[selected.type] : 'Color'}</h2>
            <div className="flex gap-2.5">{COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => { setColor(c); if (selected) setField('color', c); }}
                className={`h-7 w-7 rounded-full border-[3px] ${(selected ? selected.color : color) === c ? 'border-fg' : 'border-surface ring-1 ring-line'}`} style={{ background: c }} />))}</div>
            {textual && (
              <>
                <label className="block text-sm font-medium">Wording
                  <input value={selected.text} onChange={(e) => setField('text', e.target.value, true)} className={`${fieldCls} w-full`} /></label>
                {!SAFE.test(selected.text) && <p className="text-xs text-danger">Some characters can't be drawn with the built-in fonts and will block saving.</p>}
                <div className="flex gap-3">
                  <label className="text-sm font-medium">Size
                    <input type="number" min="6" max="96" step="0.5" value={Math.round(selected.size * 10) / 10} onChange={(e) => setField('size', Math.min(96, Math.max(6, +e.target.value || 12)), true)} className={`${fieldCls} w-20`} /></label>
                  <label className="min-w-0 flex-1 text-sm font-medium">Font
                    <select value={selected.family || 'sans'} onChange={(e) => setField('family', e.target.value)} className={`${fieldCls} w-full`}>
                      <option value="sans">Sans (Helvetica)</option><option value="serif">Serif (Times)</option><option value="mono">Mono (Courier)</option></select></label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="icon" variant={selected.bold ? 'primary' : 'secondary'} aria-pressed={!!selected.bold} aria-label="Bold" onClick={() => setField('bold', !selected.bold)}><Bold size={14} /></Button>
                  <Button size="icon" variant={selected.italic ? 'primary' : 'secondary'} aria-pressed={!!selected.italic} aria-label="Italic" onClick={() => setField('italic', !selected.italic)}><Italic size={14} /></Button>
                  {selected.type === 'edit' && [['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Icon]) => (
                    <Button key={a} size="icon" variant={(selected.align || 'left') === a ? 'primary' : 'secondary'} aria-label={`Align ${a}`} onClick={() => setField('align', a)}><Icon size={14} /></Button>))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">Text color <input type="color" value={selected.color} onChange={(e) => setField('color', e.target.value, true)} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" /></label>
                  {selected.type === 'edit' && <label className="flex items-center gap-2" title="Color of the patch that hides the original text">Patch <input type="color" value={selected.bg} onChange={(e) => setField('bg', e.target.value, true)} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" /></label>}
                </div>
              </>
            )}
            {selected?.type === 'edit' ? (
              <div className="grid gap-2">
                <Button size="sm" onClick={() => { snap(); patch(selected.id, { text: '' }); setEditing(null); }}><Trash2 size={14} /> Delete this text</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(selected.id)}>Restore original</Button>
              </div>
            ) : selected ? <Button variant="danger" className="w-full" onClick={() => remove(selected.id)}><Trash2 size={14} /> Delete</Button>
              : <p className="text-sm text-muted">Pick <b>Edit existing text</b> and click a line on the page to change, restyle or delete it. Use Select to move things you added.</p>}
            <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">Edited text is placed over a patch that hides the original, using standard PDF fonts, so the look can differ slightly. The original text stays in the file's data underneath, so don't use this to hide sensitive information. Ctrl+Z undoes; Delete removes the selected item.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
