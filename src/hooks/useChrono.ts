import { useEffect, useState } from 'react';

/**
 * Hook chrono live · alimente l'affichage du timer d'intervention
 * Calcule en secondes l'écart entre debut et maintenant
 */
export function useChrono(debutISO: string | null): number {
  const [secondes, setSecondes] = useState(() => {
    if (!debutISO) return 0;
    return Math.floor((Date.now() - new Date(debutISO).getTime()) / 1000);
  });

  useEffect(() => {
    if (!debutISO) return;
    const interval = setInterval(() => {
      setSecondes(Math.floor((Date.now() - new Date(debutISO).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [debutISO]);

  return secondes;
}
