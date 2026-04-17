import { cn } from '@/lib/utils';
import { useParcs } from '@/hooks/queries/useReferentiel';
import type { TypeControle, StatutControle } from '@/types/database';

interface Raccourci {
  label: string;
  debut: string;
  fin: string;
}

function getRaccourcis(): Raccourci[] {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const j7 = new Date(now);
  j7.setDate(j7.getDate() - 7);

  const j30 = new Date(now);
  j30.setDate(j30.getDate() - 30);

  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  const moisDernier = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finMoisDernier = new Date(now.getFullYear(), now.getMonth(), 0);

  const moisTrimestre = Math.floor(now.getMonth() / 3) * 3;
  const debutTrimestre = new Date(now.getFullYear(), moisTrimestre, 1);

  const debutAnnee = new Date(now.getFullYear(), 0, 1);

  return [
    { label: "Aujourd'hui", debut: today, fin: today },
    { label: '7 jours', debut: j7.toISOString().slice(0, 10), fin: today },
    { label: '30 jours', debut: j30.toISOString().slice(0, 10), fin: today },
    { label: 'Ce mois', debut: debutMois.toISOString().slice(0, 10), fin: today },
    { label: 'Mois dernier', debut: moisDernier.toISOString().slice(0, 10), fin: finMoisDernier.toISOString().slice(0, 10) },
    { label: 'Trimestre', debut: debutTrimestre.toISOString().slice(0, 10), fin: today },
    { label: 'Annee', debut: debutAnnee.toISOString().slice(0, 10), fin: today },
  ];
}

const types: { label: string; value: TypeControle | '' }[] = [
  { label: 'Tous', value: '' },
  { label: 'Quotidien', value: 'quotidien' },
  { label: 'Hebdo', value: 'hebdo' },
  { label: 'Mensuel', value: 'mensuel' },
];

const statuts: { label: string; value: StatutControle | '' }[] = [
  { label: 'Tous', value: '' },
  { label: 'Valide', value: 'valide' },
  { label: 'En cours', value: 'en_cours' },
  { label: 'Echec', value: 'echec' },
  { label: 'Remplace', value: 'remplace' },
];

interface FiltresHistoriqueProps {
  dateDebut: string;
  dateFin: string;
  parcId: string;
  type: TypeControle | '';
  statut: StatutControle | '';
  recherche: string;
  onChangeDateDebut: (v: string) => void;
  onChangeDateFin: (v: string) => void;
  onChangeParcId: (v: string) => void;
  onChangeType: (v: TypeControle | '') => void;
  onChangeStatut: (v: StatutControle | '') => void;
  onChangeRecherche: (v: string) => void;
}

export function FiltresHistorique({
  dateDebut,
  dateFin,
  parcId,
  type,
  statut,
  recherche,
  onChangeDateDebut,
  onChangeDateFin,
  onChangeParcId,
  onChangeType,
  onChangeStatut,
  onChangeRecherche,
}: FiltresHistoriqueProps) {
  const { data: parcs } = useParcs();
  const raccourcis = getRaccourcis();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {raccourcis.map((r) => {
          const actif = dateDebut === r.debut && dateFin === r.fin;
          return (
            <button
              key={r.label}
              onClick={() => { onChangeDateDebut(r.debut); onChangeDateFin(r.fin); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[34px] transition-colors',
                actif
                  ? 'bg-nikito-cyan/20 text-nikito-cyan border border-nikito-cyan/30'
                  : 'bg-bg-deep border border-white/[0.08] text-dim hover:text-text'
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => onChangeDateDebut(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 py-2 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[40px]"
          />
        </div>
        <div>
          <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => onChangeDateFin(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 py-2 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[40px]"
          />
        </div>
        <div>
          <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">Parc</label>
          <select
            value={parcId}
            onChange={(e) => onChangeParcId(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 py-2 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[40px]"
          >
            <option value="">Tous les parcs</option>
            {parcs?.map((p) => (
              <option key={p.id} value={p.id}>{p.code}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">Controleur</label>
          <input
            type="text"
            value={recherche}
            onChange={(e) => onChangeRecherche(e.target.value)}
            placeholder="Rechercher..."
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 py-2 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[40px] w-[180px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-dim uppercase tracking-wider mr-1">Type</span>
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => onChangeType(t.value as TypeControle | '')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium min-h-[30px] transition-colors',
                type === t.value
                  ? 'bg-nikito-cyan/20 text-nikito-cyan'
                  : 'bg-bg-deep text-dim hover:text-text'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-dim uppercase tracking-wider mr-1">Statut</span>
          {statuts.map((s) => (
            <button
              key={s.value}
              onClick={() => onChangeStatut(s.value as StatutControle | '')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium min-h-[30px] transition-colors',
                statut === s.value
                  ? 'bg-nikito-cyan/20 text-nikito-cyan'
                  : 'bg-bg-deep text-dim hover:text-text'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
