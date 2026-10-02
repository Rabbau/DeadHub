import { useEffect, useState } from 'react';
import { fetchPatches } from '../api/index.js';

/** Список обновлений игры (новые сверху). Ответ кешируется, поэтому повторные заходы мгновенные. */
export function usePatches() {
  const [state, setState] = useState({ patches: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchPatches()
      .then((patches) => { if (!cancelled) setState({ patches, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ patches: [], loading: false, error: e.message }); });
    return () => { cancelled = true; };
  }, []);

  return state;
}
