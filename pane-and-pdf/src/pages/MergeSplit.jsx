import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Alert, Button, Card, EmptyState, PageHeader, ProgressBar, Spinner } from '../ui';
import DocPicker from '../components/DocPicker';
import ResultPanel from '../components/ResultPanel';
import { useLibrary } from '../hooks/useLibrary';
import { useTask } from '../hooks/useTask';
import { pdfOps } from '../services/pdf/engine';
import { getDocumentBlob } from '../services/storage/storageService';
import { saveResultPdf } from '../services/documents';
import { parseRanges } from '../lib/pageRanges';
import { baseName } from '../lib/format';

const Tab = ({ on, children, ...p }) => <button type="button" className={`rounded-ui px-4 py-2 text-sm font-medium ${on ? 'bg-brand text-brand-fg' : 'bg-surface-2'}`} {...p}>{children}</button>;

export default function MergeSplit() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'split' ? 'split' : 'merge');
  const { docs, refresh } = useLibrary();
  const [order, setOrder] = useState([]); // selected ids in merge order
  const [splitId, setSplitId] = useState('');
  const [mode, setMode] = useState('each');
  const [ranges, setRanges] = useState('1-2, 3');
  const [results, setResults] = useState([]);
  const { busy, progress, error, run } = useTask();
  const byId = (id) => docs.find((d) => d.id === id);
  const toggle = (id) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const move = (i, d) => setOrder((o) => { const n = [...o]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  const merge = () => run(async (p) => {
    setResults([]);
    const blobs = await Promise.all(order.map(getDocumentBlob));
    const blob = await pdfOps.merge(blobs, { onProgress: p });
    const name = 'merged.pdf'; const meta = await saveResultPdf(blob, name, 'merge');
    setResults([{ name, blob, id: meta.id }]); refresh();
  });

  const split = () => run(async (p) => {
    setResults([]);
    const doc = byId(splitId);
    const groups = mode === 'each' ? Array.from({ length: doc.pageCount }, (_, i) => [i]) : parseRanges(ranges, doc.pageCount);
    const blobs = await pdfOps.split(await getDocumentBlob(splitId), groups, { onProgress: p });
    const out = [];
    for (const [i, blob] of blobs.entries()) {
      const label = groups[i].length === 1 ? `page-${groups[i][0] + 1}` : `pages-${groups[i][0] + 1}-${groups[i].at(-1) + 1}`;
      const name = `${baseName(doc.name)}-${label}.pdf`; out.push({ name, blob, id: (await saveResultPdf(blob, name, 'split')).id });
    }
    setResults(out); refresh();
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Merge & Split" description="Results are saved to your Library and offered for download." />
      <div className="flex gap-2"><Tab on={tab === 'merge'} onClick={() => { setTab('merge'); setResults([]); }}>Merge</Tab><Tab on={tab === 'split'} onClick={() => { setTab('split'); setResults([]); }}>Split</Tab></div>
      <Card className="space-y-4">
        {tab === 'merge' ? (
          <>
            {!docs.length && <EmptyState title="Your Library is empty">Add PDFs on the Library page first.</EmptyState>}
            <ul className="space-y-1">
              {docs.map((d) => <li key={d.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={order.includes(d.id)} onChange={() => toggle(d.id)} /> {d.name} <span className="text-muted">({d.pageCount} pages)</span></label></li>)}
            </ul>
            {order.length > 0 && <div><p className="mb-1 text-sm font-medium">Merge order</p>
              <ol className="space-y-1">{order.map((id, i) => <li key={id} className="flex items-center gap-1 text-sm"><span className="flex-1 truncate">{i + 1}. {byId(id)?.name}</span>
                <Button size="icon" variant="ghost" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp size={14} /></Button>
                <Button size="icon" variant="ghost" disabled={i === order.length - 1} aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown size={14} /></Button></li>)}</ol></div>}
            <Button variant="primary" disabled={order.length < 2 || busy} onClick={merge}>{busy && <Spinner />} Merge {order.length || ''} PDFs</Button>
          </>
        ) : (
          <>
            <DocPicker docs={docs} value={splitId} onChange={setSplitId} onImported={refresh} />
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-sm">Split<select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 block rounded-ui border border-line bg-surface px-3 py-2"><option value="each">Every page separately</option><option value="ranges">By page ranges</option></select></label>
              {mode === 'ranges' && <label className="text-sm">Ranges (each becomes a file)<input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 5, 7-9" className="mt-1 block rounded-ui border border-line bg-surface px-3 py-2" /></label>}
              <Button variant="primary" disabled={!splitId || busy} onClick={split}>{busy && <Spinner />} Split</Button>
            </div>
          </>
        )}
        {busy && <ProgressBar value={progress} label="Working" />}
        {error && <Alert>{error}</Alert>}
      </Card>
      {results.length > 0 && <ResultPanel title={`${results.length} file${results.length > 1 ? 's' : ''} created`} items={results} />}
    </div>
  );
}
