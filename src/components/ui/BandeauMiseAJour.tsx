import { useEffect, useState } from 'react';
import { actualiserApplication, EVT_NOUVELLE_VERSION, nouvelleVersionDisponible } from '@/lib/miseAJour';

/**
 * Bandeau « Nouvelle version d'ALBA » : affiché dès qu'une nouvelle version est
 * en ligne. L'appli se met à jour seule dès que l'écran n'est plus touché ;
 * le bouton permet de le faire tout de suite.
 */
export function BandeauMiseAJour() {
  const [visible, setVisible] = useState(nouvelleVersionDisponible());
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const afficher = () => setVisible(true);
    window.addEventListener(EVT_NOUVELLE_VERSION, afficher);
    return () => window.removeEventListener(EVT_NOUVELLE_VERSION, afficher);
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[300] flex justify-center px-3 pt-[max(env(safe-area-inset-top),8px)] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-bg-card border border-nikito-cyan/50 shadow-lg px-3.5 py-2.5 max-w-[520px] w-full">
        <span className="text-[13px] flex-1">
          Nouvelle version d’ALBA disponible
          <span className="block text-[11px] text-dim">Mise à jour automatique dans un instant</span>
        </span>
        <button
          onClick={() => {
            setEnCours(true);
            void actualiserApplication();
          }}
          disabled={enCours}
          className="bg-gradient-cta text-text px-4 rounded-[10px] text-[12px] font-bold min-h-[40px] disabled:opacity-60"
        >
          {enCours ? 'Mise à jour…' : 'Mettre à jour'}
        </button>
      </div>
    </div>
  );
}
