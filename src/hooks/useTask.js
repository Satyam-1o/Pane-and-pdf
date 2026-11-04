import { useCallback, useState } from 'react';

/** Wraps a long operation with busy/progress/error state. run(async (setProgress) => result) */
export function useTask() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const run = useCallback(async (fn) => {
    setBusy(true); setProgress(0); setError(null);
    try { return await fn(setProgress); }
    catch (e) { setError(e?.message || String(e)); return undefined; }
    finally { setBusy(false); }
  }, []);
  return { busy, progress, error, run, setError };
}
