import { useEffect, useState } from 'react';

/** Écran large tenu en largeur (ordinateur, tablette) : pas un téléphone, même tourné */
export const REQUETE_ECRAN_LARGE = '(min-width: 768px) and (min-height: 600px) and (orientation: landscape)';

export function useEcranLarge(): boolean {
  const [large, setLarge] = useState(() => typeof window !== 'undefined' && window.matchMedia(REQUETE_ECRAN_LARGE).matches);
  useEffect(() => {
    const mq = window.matchMedia(REQUETE_ECRAN_LARGE);
    const maj = () => setLarge(mq.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  return large;
}
