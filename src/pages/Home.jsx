import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Dropzone } from '../ui';
import DocThumb from '../components/DocThumb';
import { TOOLS } from '../config/tools';
import { useLibrary } from '../hooks/useLibrary';
import { useTask } from '../hooks/useTask';
import { importPdfFiles } from '../services/documents';

export default function Home() {
  const nav = useNavigate();
  const { docs } = useLibrary();
  const { busy, error, run } = useTask();
  const [problems, setProblems] = useState([]);

  const start = (files) => run(async () => {
    const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (imgs.length && !pdfs.length) { nav('/images-to-pdf', { state: { files: imgs } }); return; }
    const { saved, errors } = await importPdfFiles(pdfs);
    setProblems(errors);
    if (saved.length) nav(saved.length === 1 ? `/view/${saved[0].id}` : '/library');
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-4">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl">Work on your PDFs without sending them anywhere.</h1>
          <p className="max-w-md text-[17px] leading-relaxed text-muted">Merge, split, annotate and compress right here. Your files are processed and stored in this browser only.</p>
        </div>
        <div className="space-y-3">
          <Dropzone accept="application/pdf,.pdf,image/*" title="Drop a PDF to start" hint="or drop images to turn them into a PDF" onFiles={start} disabled={busy} />
          {error && <Alert>{error}</Alert>}
          {problems.map((p) => <Alert key={p}>{p}</Alert>)}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-[22px] font-semibold">What do you want to do?</h2>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map(({ to, title, desc, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex h-full min-h-[132px] flex-col gap-3 rounded-[10px] border border-line bg-surface p-5 transition-colors hover:border-brand">
                <Icon size={26} className="text-brand" />
                <span className="text-base font-semibold">{title}</span>
                <span className="text-[13px] leading-snug text-muted">{desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {docs.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-[22px] font-semibold">Pick up where you left off</h2>
          <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {docs.slice(0, 4).map((d) => (
              <li key={d.id}>
                <Link to={`/view/${d.id}`} className="block space-y-2.5">
                  <DocThumb id={d.id} />
                  <div>
                    <div className="truncate text-sm font-semibold" title={d.name}>{d.name}</div>
                    <div className="text-xs text-muted">{d.pageCount ?? '?'} pages · {new Date(d.updatedAt).toLocaleDateString()}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
