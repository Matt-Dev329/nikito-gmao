import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Mode = 'corriger' | 'reformuler';

/**
 * Boutons IA sous un champ de texte : « Corriger » (fautes seulement) et
 * « Reformuler » (phrases claires, même sens). Le texte proposé remplace la
 * saisie ; « Annuler » remet le texte d'origine.
 */
export function CorrectionIA({
  valeur,
  onChange,
  desactive,
  className,
}: {
  valeur: string;
  onChange: (texte: string) => void;
  desactive?: boolean;
  className?: string;
}) {
  const [enCours, setEnCours] = useState<Mode | null>(null);
  const [avant, setAvant] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = async (mode: Mode) => {
    const texte = valeur.trim();
    if (!texte || enCours) return;
    setEnCours(mode);
    setErreur(null);
    try {
      const { data, error } = await supabase.functions.invoke('corriger-texte', { body: { texte, mode } });
      const r = data as { success?: boolean; texte?: string; error?: string } | null;
      if (error || !r?.success || !r.texte) throw new Error(r?.error ?? 'Correction impossible pour le moment');
      if (r.texte !== valeur) {
        setAvant(valeur);
        onChange(r.texte);
      }
    } catch (e) {
      setErreur(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'Pas de connexion : correction indisponible'
          : (e as Error).message || 'Correction impossible pour le moment'
      );
    } finally {
      setEnCours(null);
    }
  };

  const vide = !valeur.trim();
  const bouton = 'px-2.5 rounded-md text-[11px] min-h-[32px] border transition-colors disabled:opacity-40';

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 mt-1.5', className)}>
      <button
        type="button"
        onClick={() => void lancer('corriger')}
        disabled={desactive || vide || !!enCours}
        className={cn(bouton, 'border-nikito-cyan/40 text-nikito-cyan bg-transparent')}
      >
        {enCours === 'corriger' ? 'Correction…' : '✨ Corriger les fautes'}
      </button>
      <button
        type="button"
        onClick={() => void lancer('reformuler')}
        disabled={desactive || vide || !!enCours}
        className={cn(bouton, 'border-nikito-violet/40 text-nikito-violet bg-transparent')}
      >
        {enCours === 'reformuler' ? 'Reformulation…' : '✍️ Reformuler'}
      </button>
      {avant !== null && !enCours && (
        <button
          type="button"
          onClick={() => {
            onChange(avant);
            setAvant(null);
          }}
          className={cn(bouton, 'border-white/10 text-dim bg-transparent')}
        >
          ↩ Annuler
        </button>
      )}
      {erreur && <span className="text-[11px] text-red">{erreur}</span>}
    </div>
  );
}
