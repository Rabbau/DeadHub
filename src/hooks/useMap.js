import { useEffect, useState } from 'react';
import { fetchMap } from '../api/index.js';

/** Карта города (облегчённая). Ответ кешируется, поэтому повторные заходы мгновенные. */
export function useMap() {
  const [state, setState] = useState({ map: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchMap()
      .then((map) => { if (!cancelled) setState({ map, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ map: null, loading: false, error: e.message }); });
    return () => { cancelled = true; };
  }, []);

  return state;
}
