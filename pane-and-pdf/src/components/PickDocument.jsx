import { useNavigate } from 'react-router-dom';
import { Card, PageHeader } from '../ui';
import DocPicker from './DocPicker';
import { useLibrary } from '../hooks/useLibrary';

/** Shown by tools that need a document when opened without one (e.g. /organize). */
export default function PickDocument({ title, description, toolPath }) {
  const { docs, refresh } = useLibrary();
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={title} description={description} />
      <Card><DocPicker docs={docs} value="" onChange={(id) => id && nav(`${toolPath}/${id}`)} onImported={refresh} /></Card>
    </div>
  );
}
