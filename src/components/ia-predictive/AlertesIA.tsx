import { cn } from '@/lib/utils';
import { Card, CardHead } from '@/components/ui/Card';
import type { AlerteIA } from '@/types/ia-predictive';

interface Props {
  alertes: AlerteIA[];
}

const typeConfig: Record<AlerteIA['type'], { icon: string; color: string }> = {
  garantie_expiration: { icon: '⏰', color: 'border-l-amber' },
  controle_manquant: { icon: '📋', color: 'border-l-red' },
  stock_critique: { icon: '📦', color: 'border-l-amber' },
  certification_expiration: { icon: '📜', color: 'border-l-red' },
  tendance_degradation: { icon: '⚠️', color: 'border-l-red' },
};

const prioriteStyle = {
  haute: 'bg-red/10 text-red',
  moyenne: 'bg-amber/10 text-amber',
  basse: 'bg-nikito-cyan/10 text-nikito-cyan',
};

export function AlertesIA({ alertes }: Props) {
  if (alertes.length === 0) {
    return (
      <Card>
        <CardHead titre="Alertes" />
        <div className="text-dim text-sm py-6 text-center">
          Aucune alerte
        </div>
      </Card>
    );
  }

  const sorted = [...alertes].sort((a, b) => {
    const order = { haute: 0, moyenne: 1, basse: 2 };
    return order[a.priorite] - order[b.priorite];
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <h3 className="text-[13px] font-medium">Alertes</h3>
        <span className="text-[11px] text-amber font-medium">
          {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((alerte, i) => {
          const config = typeConfig[alerte.type];
          return (
            <div
              key={i}
              className={cn(
                'bg-bg-card rounded-xl p-3.5 border-l-[3px] flex items-start gap-3',
                config.color
              )}
            >
              <span className="text-base flex-shrink-0 mt-0.5">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-text leading-relaxed">
                  {alerte.message}
                </div>
                <div className="text-[11px] text-dim mt-1">
                  {alerte.parc}
                </div>
              </div>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0', prioriteStyle[alerte.priorite])}>
                {alerte.priorite.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
