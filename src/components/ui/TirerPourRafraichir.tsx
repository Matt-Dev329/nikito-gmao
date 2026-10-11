import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { verifierMiseAJour } from '@/lib/miseAJour';
import { rejouer } from '@/lib/horsLigne/file';

const SEUIL = 70;
const MAX = 110;

/** Un élément (ou un parent) défile déjà, ou est dans une fenêtre fixe (modale) : on ne rafraîchit pas. */
function gesteAutorise(cible: EventTarget | null): boolean {
  if (window.scrollY > 0) return false;
  let el = cible instanceof Element ? cible : null;
  while (el && el !== document.body) {
    if (el.scrollTop > 0) return false;
    if (getComputedStyle(el).position === 'fixed') return false;
    el = el.parentElement;
  }
  return true;
}

/**
 * « Tirer pour rafraîchir » sur téléphone / tablette (l'appli installée n'a
 * ni barre d'adresse ni geste natif) : recharge les données, envoie les
 * saisies hors connexion en attente et récupère la dernière version de l'appli.
 */
export function TirerPourRafraichir() {
  const qc = useQueryClient();
  const [tirage, setTirage] = useState(0);
  const [actualisation, setActualisation] = useState(false);
  const depart = useRef<number | null>(null);
  const tirageRef = useRef(0);
  const actualisationRef = useRef(false);

  useEffect(() => {
    if (!('ontouchstart' in window)) return;

    const debut = (e: TouchEvent) => {
      if (e.touches.length !== 1 || actualisationRef.current) return;
      depart.current = gesteAutorise(e.target) ? e.touches[0].clientY : null;
    };
    const mouvement = (e: TouchEvent) => {
      if (depart.current === null) return;
      const dy = e.touches[0].clientY - depart.current;
      const v = dy > 0 ? Math.min(MAX, dy * 0.5) : 0;
      tirageRef.current = v;
      setTirage(v);
    };
    const fin = async () => {
      const v = tirageRef.current;
      depart.current = null;
      tirageRef.current = 0;
      setTirage(0);
      if (v < SEUIL) return;
      actualisationRef.current = true;
      setActualisation(true);
      try {
        await verifierMiseAJour(); // nouvelle version prête → l'appli se recharge seule
        await Promise.all([qc.invalidateQueries(), rejouer()]);
      } finally {
        window.setTimeout(() => {
          actualisationRef.current = false;
          setActualisation(false);
        }, 500);
      }
    };

    window.addEventListener('touchstart', debut, { passive: true });
    window.addEventListener('touchmove', mouvement, { passive: true });
    window.addEventListener('touchend', fin);
    window.addEventListener('touchcancel', fin);
    return () => {
      window.removeEventListener('touchstart', debut);
      window.removeEventListener('touchmove', mouvement);
      window.removeEventListener('touchend', fin);
      window.removeEventListener('touchcancel', fin);
    };
  }, [qc]);

  if (!actualisation && tirage < 8) return null;
  const pret = tirage >= SEUIL;

  return (
    <div
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[110] flex justify-center pointer-events-none"
      style={{ transform: `translateY(${actualisation ? 56 : tirage * 0.8}px)` }}
    >
      <div
        className={cn(
          'mt-2 px-3.5 py-2 rounded-full bg-bg-card border text-[12px] font-semibold shadow-lg flex items-center gap-2',
          pret || actualisation ? 'border-nikito-cyan text-nikito-cyan' : 'border-white/[0.12] text-dim'
        )}
      >
        <span
          className={cn('inline-block transition-transform', actualisation && 'animate-spin')}
          style={actualisation ? undefined : { transform: `rotate(${pret ? 180 : 0}deg)` }}
        >
          {actualisation ? '⟳' : '↓'}
        </span>
        {actualisation ? 'Actualisation…' : pret ? 'Relâche pour actualiser' : 'Tire pour actualiser'}
      </div>
    </div>
  );
}
