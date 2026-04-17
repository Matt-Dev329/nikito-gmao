import { cn } from '@/lib/utils';
import { useParcs, useCategoriesEquipement } from '@/hooks/queries/useReferentiel';
import type { StatutEquipement } from '@/types/database';

const STATUTS: Array<{ value: StatutEquipement | 'tous'; label: string }> = [
  { value: 'tous', label: 'Tous' },
  { value: 'actif', label: 'Actif' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'hors_service', label: 'Hors service' },
  { value: 'archive', label: 'Archive' },
];

interface FiltresEquipementsProps {
  parcId: string | undefined;
  onParcChange: (id: string | undefined) => void;
  categorieId: string | undefined;
  onCategorieChange: (id: string | undefined) => void;
  statut: StatutEquipement | 'tous';
  onStatutChange: (s: StatutEquipement | 'tous') => void;
  recherche: string;
  onRechercheChange: (v: string) => void;
}

export function FiltresEquipements({
  parcId,
  onParcChange,
  categorieId,
  onCategorieChange,
  statut,
  onStatutChange,
  recherche,
  onRechercheChange,
}: FiltresEquipementsProps) {
  const { data: parcs } = useParcs();
  const { data: categories } = useCategoriesEquipement();

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={recherche}
            onChange={(e) => onRechercheChange(e.target.value)}
            placeholder="Rechercher par code, libelle ou n° serie..."
            className="w-full bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
        </div>
        <select
          value={parcId ?? ''}
          onChange={(e) => onParcChange(e.target.value || undefined)}
          className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[160px]"
        >
          <option value="">Tous les parcs</option>
          {parcs?.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>
          ))}
        </select>
        <select
          value={categorieId ?? ''}
          onChange={(e) => onCategorieChange(e.target.value || undefined)}
          className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[200px]"
        >
          <option value="">Toutes categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-px">
        {STATUTS.map((s) => (
          <button
            key={s.value}
            onClick={() => onStatutChange(s.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-pill text-xs transition-colors whitespace-nowrap min-h-[36px]',
              statut === s.value
                ? 'bg-nikito-cyan text-bg-app border-none font-semibold'
                : 'bg-bg-card border border-white/[0.06] text-dim hover:border-white/20'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
