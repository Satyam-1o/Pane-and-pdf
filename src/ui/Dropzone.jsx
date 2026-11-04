import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

export default function Dropzone({ onFiles, accept, multiple = true, title = 'Drop files here', hint, disabled }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const pick = (list) => { const files = Array.from(list || []); if (files.length) onFiles(multiple ? files : files.slice(0, 1)); };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files); }}
      className={`rounded-ui border-2 border-dashed p-8 text-center transition-colors ${over ? 'border-brand bg-brand/5' : 'border-line'} ${disabled ? 'opacity-50' : ''}`}
    >
      <Upload className="mx-auto mb-2 text-muted" />
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="mt-3 rounded-ui bg-brand px-3.5 py-2 text-sm font-medium text-brand-fg">
        Choose {multiple ? 'files' : 'a file'}
      </button>
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
