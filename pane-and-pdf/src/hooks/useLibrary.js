import { useCallback, useEffect, useState } from 'react';
import { listDocuments } from '../services/storage/storageService';

export function useLibrary() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try { setDocs(await listDocuments()); setError(null); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { docs, loading, error, refresh };
}
