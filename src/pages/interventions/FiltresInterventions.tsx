import { cn } from '@/lib/utils';
import type { InterventionSuivi } from '@/hooks/queries/useInterventionsSuivi';

export type FiltreStatut = 'tous' | 'en_cours' | 'en_attente' | 'termines';
export type FiltrePeriode = 'aujourdhui' | '7j' | '30j';

interface Props {
  statut: FiltreStatut;
  periode: FiltrePeriode;
  equipementId: string;
  recherche: string;
  equipements: { code: string; libelle: string }[];
  onStatutChange: (v: FiltreStatut) => void;
  onPeriodeChange: (v: FiltrePeriode) => void;
  onEquipementChange: (v: string) => void;
  onRechercheChange: (v: string) => void;
}

const statuts: { value: FiltreStatut; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'termines', label: 'Termines' },
];

const periodes: { value: FiltrePeriode; label: string }[] = [
  { value: 'aujourdhui', label: "Aujourd'hui" },
  { value: '7j', label: '7 jours' },
  { value: '30j', label: '30 jours' },
];

export function FiltresInterventions({
  statut, periode, equipementId, recherche,
  equipements,
  onStatutChange, onPeriodeChange, onEquipementChange, onRechercheChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="flex gap-1 bg-bg-deep rounded-lg p-0.5">
        {statuts.map((s) => (
          <button
            key={s.value}
            onClick={() => onStatutChange(s.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors',
              statut === s.value
                ? 'bg-bg-card text-text shadow-sm'
                : 'text-dim hover:text-text'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 bg-bg-deep rounded-lg p-0.5">
        {periodes.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodeChange(p.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors',
              periode === p.value
                ? 'bg-bg-card text-text shadow-sm'
                : 'text-dim hover:text-text'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <select
        value={equipementId}
        onChange={(e) => onEquipementChange(e.target.value)}
        className="bg-bg-deep border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-text min-h-[32px]"
      >
        <option value="">Tous les equipements</option>
        {equipements.map((eq) => (
          <option key={eq.code} value={eq.code}>{eq.code} - {eq.libelle}</option>
        ))}
      </select>

      <div className="relative sm:ml-auto">
        <input
          type="text"
          value={recherche}
          onChange={(e) => onRechercheChange(e.target.value)}
          placeholder="Rechercher BT, description..."
          className="bg-bg-deep border border-white/[0.06] rounded-lg px-3 py-1.5 pl-8 text-[11px] text-text min-h-[32px] w-full sm:w-[200px]"
        />
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M12.5 12.5L17 17" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export function applyFilters(
  interventions: InterventionSuivi[],
  statut: FiltreStatut,
  periode: FiltrePeriode,
  equipementCode: string,
  recherche: string,
): InterventionSuivi[] {
  let filtered = [...interventions];

  if (statut === 'en_cours') {
    filtered = filtered.filter((i) => i.statut === 'en_cours');
  } else if (statut === 'en_attente') {
    filtered = filtered.filter((i) => i.statut === 'ouvert' || i.statut === 'assigne');
  } else if (statut === 'termines') {
    filtered = filtered.filter((i) => i.statut === 'resolu' || i.statut === 'ferme');
  }

  const now = new Date();
  if (periode === 'aujourdhui') {
    const todayStr = now.toISOString().slice(0, 10);
    filtered = filtered.filter((i) => i.declare_le?.slice(0, 10) === todayStr);
  } else if (periode === '7j') {
    const cutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    filtered = filtered.filter((i) => i.declare_le >= cutoff);
  } else if (periode === '30j') {
    const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    filtered = filtered.filter((i) => i.declare_le >= cutoff);
  }

  if (equipementCode) {
    filtered = filtered.filter((i) => i.equipement_code === equipementCode);
  }

  if (recherche.trim()) {
    const q = recherche.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.numero_bt.toLowerCase().includes(q) ||
        i.titre.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        i.equipement_code.toLowerCase().includes(q) ||
        i.equipement_libelle.toLowerCase().includes(q)
    );
  }

  const statutOrdre: Record<string, number> = {
    en_cours: 1,
    ouvert: 2,
    assigne: 2,
    resolu: 3,
    ferme: 4,
    annule: 5,
  };
  filtered.sort((a, b) => {
    const sa = statutOrdre[a.statut] ?? 9;
    const sb = statutOrdre[b.statut] ?? 9;
    if (sa !== sb) return sa - sb;
    return new Date(b.declare_le).getTime() - new Date(a.declare_le).getTime();
  });

  return filtered;
}
