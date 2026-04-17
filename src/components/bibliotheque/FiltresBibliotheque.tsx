import { cn } from '@/lib/utils';
import { useCategoriesEquipement } from '@/hooks/queries/useReferentiel';
import type { TypeControle, AssigneA } from '@/types/database';

const TYPES: Array<{ value: TypeControle | 'tous'; label: string }> = [
  { value: 'tous', label: 'Tous' },
  { value: 'quotidien', label: 'Quotidien' },
  { value: 'hebdo', label: 'Hebdo' },
  { value: 'mensuel', label: 'Mensuel' },
];

const ASSIGNATIONS: Array<{ value: AssigneA | 'tous'; label: string }> = [
  { value: 'tous', label: 'Tous' },
  { value: 'staff', label: 'Staff' },
  { value: 'tech', label: 'Technicien' },
];

interface FiltresBibliothequeProps {
  categorieId: string | undefined;
  onCategorieChange: (id: string | undefined) => void;
  typeControle: TypeControle | 'tous';
  onTypeChange: (t: TypeControle | 'tous') => void;
  assigneA: AssigneA | 'tous';
  onAssigneChange: (a: AssigneA | 'tous') => void;
  recherche: string;
  onRechercheChange: (v: string) => void;
  afficherInactifs: boolean;
  onAfficherInactifsChange: (v: boolean) => void;
}

export function FiltresBibliotheque({
  categorieId,
  onCategorieChange,
  typeControle,
  onTypeChange,
  assigneA,
  onAssigneChange,
  recherche,
  onRechercheChange,
  afficherInactifs,
  onAfficherInactifsChange,
}: FiltresBibliothequeProps) {
  const { data: categories } = useCategoriesEquipement();

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={recherche}
            onChange={(e) => onRechercheChange(e.target.value)}
            placeholder="Rechercher un point de controle..."
            className="w-full bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
        </div>
        <select
          value={categorieId ?? ''}
          onChange={(e) => onCategorieChange(e.target.value || undefined)}
          className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[220px]"
        >
          <option value="">Toutes categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-px">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => onTypeChange(t.value)}
              className={cn(
                'px-3.5 py-1.5 rounded-pill text-xs transition-colors whitespace-nowrap min-h-[36px]',
                typeControle === t.value
                  ? 'bg-nikito-cyan text-bg-app border-none font-semibold'
                  : 'bg-bg-card border border-white/[0.06] text-dim hover:border-white/20'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/[0.08] hidden sm:block" />

        <div className="flex gap-1.5 overflow-x-auto pb-px">
          {ASSIGNATIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => onAssigneChange(a.value)}
              className={cn(
                'px-3.5 py-1.5 rounded-pill text-xs transition-colors whitespace-nowrap min-h-[36px]',
                assigneA === a.value
                  ? 'bg-nikito-pink/80 text-text border-none font-semibold'
                  : 'bg-bg-card border border-white/[0.06] text-dim hover:border-white/20'
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/[0.08] hidden sm:block" />

        <button
          onClick={() => onAfficherInactifsChange(!afficherInactifs)}
          className={cn(
            'px-3.5 py-1.5 rounded-pill text-xs transition-colors whitespace-nowrap min-h-[36px]',
            afficherInactifs
              ? 'bg-faint/20 text-text border-none font-semibold'
              : 'bg-bg-card border border-white/[0.06] text-dim hover:border-white/20'
          )}
        >
          Inclure inactifs
        </button>
      </div>
    </div>
  );
}
