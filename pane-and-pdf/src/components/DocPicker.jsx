import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button, Alert } from '../ui';
import { importPdfFiles } from '../services/documents';
import { formatBytes } from '../lib/format';

/** Select a PDF from the local library, or add a new one from disk. */
export default function DocPicker({ docs, value, onChange, onImported, label = 'Document' }) {
  const input = useRef(null);
  const [err, setErr] = useState(null);
  const add = async (files) => {
    const { saved, errors } = await importPdfFiles(files);
    setErr(errors.join(' ') || null);
    if (saved.length) { await onImported?.(); onChange(saved[0].id); }
  };
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 rounded-ui border border-line bg-surface px-3 py-2 text-sm">
          <option value="">Select a PDF…</option>
          {docs.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.pageCount ?? '?'} pages · {formatBytes(d.size)}</option>)}
        </select>
        <Button onClick={() => input.current?.click()}><Upload size={16} /> Add PDF</Button>
        <input ref={input} type="file" hidden accept="application/pdf,.pdf" onChange={(e) => { add(Array.from(e.target.files)); e.target.value = ''; }} />
      </div>
      {err && <Alert>{err}</Alert>}
    </div>
  );
}
