import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { nomDepuisChemin, telechargerUrl } from '@/lib/telecharger';

/** Bouton « Télécharger » pour une photo, une vidéo ou un document (URL signée). */
export function BoutonTelecharger({
  url,
  nom,
  libelle = 'Télécharger',
  compact = false,
  className,
}: {
  url: string | null | undefined;
  /** Nom du fichier enregistré (par défaut : celui de l'URL) */
  nom?: string;
  libelle?: string;
  /** Icône seule (sur une vignette) */
  compact?: boolean;
  className?: string;
}) {
  const toast = useToast();
  const [enCours, setEnCours] = useState(false);
  return (
    <button
      type="button"
      disabled={!url || enCours}
      aria-label={libelle}
      title={libelle}
      onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!url) return;
        setEnCours(true);
        try {
          await telechargerUrl(url, nom ?? nomDepuisChemin(url));
        } catch {
          toast.error('Téléchargement impossible');
        } finally {
          setEnCours(false);
        }
      }}
      className={cn(
        compact
          ? 'w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center text-[16px] backdrop-blur-sm'
          : 'bg-bg-deep border border-white/[0.08] text-nikito-cyan px-3 rounded-lg text-[12px] font-semibold min-h-[36px] inline-flex items-center gap-1.5',
        (!url || enCours) && 'opacity-50',
        className
      )}
    >
      <span aria-hidden>{enCours ? '…' : '⬇'}</span>
      {!compact && libelle}
    </button>
  );
}
