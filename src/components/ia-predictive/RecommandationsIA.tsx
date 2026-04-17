import { Card, CardHead } from '@/components/ui/Card';
import type { RecommandationIA } from '@/types/ia-predictive';

interface Props {
  recommandations: RecommandationIA[];
  onAppliquer?: (rec: RecommandationIA) => void;
}

export function RecommandationsIA({ recommandations, onAppliquer }: Props) {
  if (recommandations.length === 0) {
    return (
      <Card>
        <CardHead titre="Recommandations" />
        <div className="text-dim text-sm py-6 text-center">
          Aucune recommandation
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <h3 className="text-[13px] font-medium">Recommandations</h3>
        <span className="text-[11px] text-dim">
          {recommandations.length} suggestion{recommandations.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {recommandations.map((rec, i) => (
          <div
            key={i}
            className="bg-bg-card rounded-xl p-4 border-l-[3px] border-l-nikito-cyan"
          >
            <div className="text-[13px] font-semibold mb-2">{rec.titre}</div>
            <div className="text-[12px] text-dim leading-relaxed mb-3">
              {rec.description}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                <div className="text-[10px] text-faint uppercase tracking-wider">Impact</div>
                <div className="text-[12px] text-green mt-0.5">{rec.impact_estime}</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                <div className="text-[10px] text-faint uppercase tracking-wider">Cout</div>
                <div className="text-[12px] text-text mt-0.5">{rec.cout_estime}</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                <div className="text-[10px] text-faint uppercase tracking-wider">Deadline</div>
                <div className="text-[12px] text-text mt-0.5">
                  {rec.deadline_suggeree
                    ? new Date(rec.deadline_suggeree).toLocaleDateString('fr-FR')
                    : '-'}
                </div>
              </div>
            </div>
            {onAppliquer && (
              <button
                onClick={() => onAppliquer(rec)}
                className="bg-white/[0.04] border border-white/[0.08] text-text px-3.5 py-2 rounded-lg text-[11px] font-medium hover:bg-white/[0.08] transition-colors min-h-[44px]"
              >
                Appliquer cette recommandation
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
