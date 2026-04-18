import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { InterventionSuivi } from '@/hooks/queries/useInterventionsSuivi';

interface Props {
  interventions: InterventionSuivi[];
}

const HOUR_START = 8;
const HOUR_END_DEFAULT = 20;

function getHourEnd(): number {
  const now = new Date();
  const h = now.getHours();
  return Math.max(h + 1, HOUR_END_DEFAULT);
}

function barColor(statut: string): string {
  if (statut === 'en_cours') return 'bg-red';
  if (statut === 'resolu' || statut === 'ferme') return 'bg-green';
  return 'bg-white/10';
}

export function TimelineDuJour({ interventions }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hourEnd = getHourEnd();
  const totalMinutes = (hourEnd - HOUR_START) * 60;

  const todayStr = new Date().toISOString().slice(0, 10);

  const bars = useMemo(() => {
    return interventions
      .filter((i) => {
        const start = i.intervention_debut ?? i.declare_le;
        return start?.slice(0, 10) === todayStr &&
          ['en_cours', 'resolu', 'ferme', 'ouvert', 'assigne'].includes(i.statut);
      })
      .map((i) => {
        const start = new Date(i.intervention_debut ?? i.declare_le);
        const end = i.intervention_fin
          ? new Date(i.intervention_fin)
          : i.resolu_le
            ? new Date(i.resolu_le)
            : new Date();

        const startMin = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
        const endMin = (end.getHours() - HOUR_START) * 60 + end.getMinutes();
        const leftPct = Math.max(0, (startMin / totalMinutes) * 100);
        const widthPct = Math.max(1, ((Math.max(endMin, startMin + 5) - startMin) / totalMinutes) * 100);

        return {
          id: i.id,
          left: leftPct,
          width: Math.min(widthPct, 100 - leftPct),
          color: barColor(i.statut),
          label: `${i.equipement_code} - ${i.titre}`,
          statut: i.statut,
          technicien: i.technicien_prenom ? `${i.technicien_prenom} ${i.technicien_nom}` : null,
        };
      });
  }, [interventions, todayStr, totalMinutes]);

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = HOUR_START; h <= hourEnd; h++) arr.push(h);
    return arr;
  }, [hourEnd]);

  if (bars.length === 0) {
    return (
      <div className="bg-bg-card rounded-2xl p-4">
        <div className="text-[11px] text-dim uppercase tracking-wider mb-3">Timeline du jour</div>
        <div className="text-[12px] text-dim text-center py-4">Aucune intervention aujourd'hui</div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-2xl p-4">
      <div className="text-[11px] text-dim uppercase tracking-wider mb-3">Timeline du jour</div>

      <div className="relative">
        <div className="flex justify-between text-[9px] text-faint mb-1 px-0">
          {hours.map((h) => (
            <span key={h} className="w-0 text-center">{h}h</span>
          ))}
        </div>

        <div className="relative h-auto min-h-[40px] bg-bg-deep rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex">
            {hours.slice(0, -1).map((h) => (
              <div key={h} className="flex-1 border-r border-white/[0.04]" />
            ))}
          </div>

          <div className="relative py-1.5 px-0.5 space-y-1">
            {bars.map((bar) => (
              <div
                key={bar.id}
                className="relative h-[22px]"
                onMouseEnter={() => setHoveredId(bar.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  className={cn(
                    'absolute top-0 h-full rounded-sm transition-opacity',
                    bar.color,
                    bar.statut === 'en_cours' && 'animate-pulse'
                  )}
                  style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                />
                {hoveredId === bar.id && (
                  <div
                    className="absolute z-30 -top-8 bg-bg-card border border-white/[0.08] rounded-lg px-2 py-1 text-[10px] text-text whitespace-nowrap shadow-xl"
                    style={{ left: `${bar.left}%` }}
                  >
                    {bar.label}
                    {bar.technicien && <span className="text-dim ml-1">({bar.technicien})</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 mt-2 text-[9px] text-dim">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green" />
            <span>Resolu</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red" />
            <span>En cours</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-white/10" />
            <span>En attente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
