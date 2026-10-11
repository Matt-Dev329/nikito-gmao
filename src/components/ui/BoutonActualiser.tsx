import { useState } from 'react';
import { cn } from '@/lib/utils';
import { actualiserApplication } from '@/lib/miseAJour';

/**
 * Bouton « Actualiser » toujours visible en haut de l'écran (téléphone /
 * tablette) : récupère la dernière version et recharge l'appli. Les saisies
 * en cours sont gardées en brouillon.
 */
export function BoutonActualiser({ className }: { className?: string }) {
  const [enCours, setEnCours] = useState(false);
  return (
    <button
      onClick={() => {
        setEnCours(true);
        actualiserApplication();
      }}
      disabled={enCours}
      aria-label="Actualiser l'application"
      title="Actualiser"
      className={cn(
        'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-bg-card border border-white/[0.08] text-nikito-cyan text-[18px] leading-none active:scale-95 transition-transform',
        className
      )}
    >
      <span className={cn('inline-block', enCours && 'animate-spin')}>⟳</span>
    </button>
  );
}
