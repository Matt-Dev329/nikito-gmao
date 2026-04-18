import { useState, useMemo } from 'react';
import { KpiCard } from '@/components/kpi/KpiCard';
import {
  useInterventionsSuivi,
  useInterventionKpis,
} from '@/hooks/queries/useInterventionsSuivi';
import { InterventionCard } from './InterventionCard';
import { TimelineDuJour } from './TimelineDuJour';
import {
  FiltresInterventions,
  applyFilters,
  type FiltreStatut,
  type FiltrePeriode,
} from './FiltresInterventions';

interface Props {
  parcId: string | null;
}

export function SuiviInterventions({ parcId }: Props) {
  const { data: interventions, isLoading } = useInterventionsSuivi(parcId);
  const kpis = useInterventionKpis(interventions);

  const [statut, setStatut] = useState<FiltreStatut>('tous');
  const [periode, setPeriode] = useState<FiltrePeriode>('aujourdhui');
  const [equipementCode, setEquipementCode] = useState('');
  const [recherche, setRecherche] = useState('');

  const equipementsList = useMemo(() => {
    if (!interventions) return [];
    const map = new Map<string, { code: string; libelle: string }>();
    for (const i of interventions) {
      if (!map.has(i.equipement_code)) {
        map.set(i.equipement_code, { code: i.equipement_code, libelle: i.equipement_libelle });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [interventions]);

  const filtered = useMemo(
    () => applyFilters(interventions ?? [], statut, periode, equipementCode, recherche),
    [interventions, statut, periode, equipementCode, recherche]
  );

  if (!parcId) {
    return <div className="text-dim text-sm py-8 text-center">Selectionnez un parc pour voir les interventions.</div>;
  }

  if (isLoading) {
    return <div className="text-dim text-sm py-8 text-center">Chargement des interventions...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="En cours"
          valeur={kpis.enCours}
          couleur="red"
          compact
        />
        <KpiCard
          label="Terminees aujourd'hui"
          valeur={kpis.termineesAujourdhui}
          couleur="green"
          compact
        />
        <KpiCard
          label="MTTR du jour"
          valeur={kpis.mttrMinutes || '—'}
          unite={kpis.mttrMinutes ? 'min' : undefined}
          couleur="cyan"
          compact
        />
        <KpiCard
          label="En attente"
          valeur={kpis.enAttente}
          couleur="amber"
          compact
        />
      </div>

      <TimelineDuJour interventions={interventions ?? []} />

      <FiltresInterventions
        statut={statut}
        periode={periode}
        equipementId={equipementCode}
        recherche={recherche}
        equipements={equipementsList}
        onStatutChange={setStatut}
        onPeriodeChange={setPeriode}
        onEquipementChange={setEquipementCode}
        onRechercheChange={setRecherche}
      />

      {filtered.length === 0 ? (
        <div className="bg-bg-card rounded-2xl p-6 text-center text-dim text-[13px]">
          Aucune intervention ne correspond aux filtres selectionnes.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((i) => (
            <InterventionCard key={i.id} intervention={i} />
          ))}
        </div>
      )}
    </div>
  );
}
