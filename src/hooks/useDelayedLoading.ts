import { useState, useEffect } from 'react';

/**
 * Suprime o estado de "loading" por `delay` ms.
 * Se os dados carregarem antes do delay, o spinner nunca aparece.
 * Isso elimina o flash em carregamentos rápidos (< 250 ms).
 *
 * Uso:
 *   const [loading, setLoading] = useState(true);
 *   const showLoader = useDelayedLoading(loading);
 *   if (showLoader) return <Spinner />;
 */
export function useDelayedLoading(loading: boolean, delay = 250): boolean {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowLoader(false);
      return;
    }
    const timer = setTimeout(() => setShowLoader(true), delay);
    return () => clearTimeout(timer);
  }, [loading, delay]);

  return showLoader;
}
