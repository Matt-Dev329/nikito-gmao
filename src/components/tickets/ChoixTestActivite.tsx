import { cn } from '@/lib/utils';

/** « Test de l'activité » oui / non : réponse obligatoire pour fermer un ticket ou enregistrer un bon. */
export function ChoixTestActivite({
  valeur,
  onChange,
  desactive,
}: {
  valeur: boolean | null;
  onChange: (v: boolean) => void;
  desactive?: boolean;
}) {
  return (
    <div className={cn('bg-bg-card rounded-xl p-3.5 px-4 border', valeur === null ? 'border-amber/50' : 'border-white/[0.06]')}>
      <div className="text-[13px] font-semibold mb-1">Test de l’activité effectué ? *</div>
      <div className="text-[11px] text-dim mb-3">Obligatoire : l’activité a-t-elle été testée après l’intervention ?</div>
      <div className="flex gap-2.5">
        <button
          type="button"
          disabled={desactive}
          onClick={() => onChange(true)}
          className={cn(
            'flex-1 py-3.5 rounded-[10px] text-sm font-bold min-h-[48px]',
            valeur === true ? 'bg-gradient-to-r from-green to-lime text-bg-app' : 'bg-bg-deep border border-white/10 text-text'
          )}
        >
          Oui
        </button>
        <button
          type="button"
          disabled={desactive}
          onClick={() => onChange(false)}
          className={cn(
            'flex-1 py-3.5 rounded-[10px] text-sm min-h-[48px]',
            valeur === false ? 'bg-amber text-bg-app font-bold' : 'bg-bg-deep border border-white/10 text-text'
          )}
        >
          Non
        </button>
      </div>
    </div>
  );
}
