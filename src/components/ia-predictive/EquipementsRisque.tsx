import { cn } from '@/lib/utils';
import { Card, CardHead } from '@/components/ui/Card';
import type { EquipementRisque } from '@/types/ia-predictive';

interface Props {
  equipements: EquipementRisque[];
  onCreerPreventif?: (eq: EquipementRisque) => void;
}

function getRisqueStyle(score: number) {
  if (score >= 70) return { border: 'border-l-red', badge: 'bg-red/15 text-red', label: 'CRITIQUE' };
  if (score >= 50) return { border: 'border-l-amber', badge: 'bg-amber/15 text-amber', label: 'ELEVE' };
  return { border: 'border-l-nikito-cyan', badge: 'bg-nikito-cyan/15 text-nikito-cyan', label: 'MODERE' };
}

const prioriteColors = {
  haute: 'text-red',
  moyenne: 'text-amber',
  basse: 'text-nikito-cyan',
};

export function EquipementsRisque({ equipements, onCreerPreventif }: Props) {
  if (equipements.length === 0) {
    return (
      <Card>
        <CardHead titre="Equipements a risque" />
        <div className="text-dim text-sm py-6 text-center">
          Aucun equipement a risque identifie
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <h3 className="text-[13px] font-medium">Equipements a risque</h3>
        <span className="text-[11px] text-red font-medium">
          {equipements.length} identifie{equipements.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {equipements.map((eq) => {
          const style = getRisqueStyle(eq.score_risque);
          return (
            <div
              key={eq.equipement_id}
              className={cn(
                'bg-bg-card rounded-xl p-4 border-l-[3px]',
                style.border
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[13px] font-semibold truncate">
                      {eq.equipement_libelle}
                    </span>
                    <span className="text-[11px] text-dim">{eq.equipement_code}</span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', style.badge)}>
                      {eq.score_risque}% {style.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-dim mb-2">
                    {eq.parc}
                  </div>
                  <div className={cn('text-[12px] font-medium mb-1.5', prioriteColors[eq.priorite])}>
                    {eq.prediction}
                  </div>
                  <div className="text-[11px] text-dim leading-relaxed mb-2">
                    {eq.justification}
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 mb-2">
                    <div className="text-[10px] text-faint uppercase tracking-wider mb-1">
                      Action recommandee
                    </div>
                    <div className="text-[12px] text-text">
                      {eq.action_recommandee}
                    </div>
                  </div>
                  {eq.date_panne_estimee && (
                    <div className="text-[11px] text-dim">
                      Panne estimee : <span className="text-text font-medium">{new Date(eq.date_panne_estimee).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                </div>
                {onCreerPreventif && (
                  <button
                    onClick={() => onCreerPreventif(eq)}
                    className="bg-nikito-cyan/10 border border-nikito-cyan/30 text-nikito-cyan px-3.5 py-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap min-h-[44px] self-start hover:bg-nikito-cyan/20 transition-colors"
                  >
                    Creer une maintenance
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
