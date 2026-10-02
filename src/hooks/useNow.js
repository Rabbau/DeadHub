import { useEffect, useState } from 'react';

/** Текущее время в мс, обновляется каждые intervalMs — для обратных отсчётов. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
