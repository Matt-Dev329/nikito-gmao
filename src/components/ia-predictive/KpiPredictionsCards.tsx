import { KpiCard } from '@/components/kpi/KpiCard';
import type { KpiPredictions } from '@/types/ia-predictive';

interface Props {
  predictions: KpiPredictions;
}

export function KpiPredictionsCards({ predictions }: Props) {
  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <h3 className="text-[13px] font-medium">Predictions a 30 jours</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="MTBF prevu"
          valeur={predictions.mtbf_prevu_30j.toFixed(1).replace('.', ',')}
          unite=" j"
          delta={{ texte: 'prevision 30j', tone: 'neutre' }}
          couleur="cyan"
          compact
        />
        <KpiCard
          label="Incidents prevus"
          valeur={predictions.incidents_prevus_30j.toString()}
          delta={{ texte: 'prevision 30j', tone: predictions.incidents_prevus_30j > 10 ? 'negatif' : 'neutre' }}
          couleur={predictions.incidents_prevus_30j > 10 ? 'red' : 'amber'}
          compact
        />
        <KpiCard
          label="Conformite prevue"
          valeur={Math.round(predictions.taux_conformite_prevu).toString()}
          unite="%"
          delta={{ texte: 'prevision 30j', tone: predictions.taux_conformite_prevu >= 90 ? 'positif' : 'negatif' }}
          couleur={predictions.taux_conformite_prevu >= 90 ? 'green' : 'amber'}
          compact
        />
        <KpiCard
          label="A surveiller"
          valeur={predictions.equipements_necessitant_attention.toString()}
          delta={{ texte: 'equipements', tone: predictions.equipements_necessitant_attention > 3 ? 'negatif' : 'neutre' }}
          couleur={predictions.equipements_necessitant_attention > 3 ? 'red' : 'cyan'}
          compact
        />
      </div>
    </div>
  );
}
