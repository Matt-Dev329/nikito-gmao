import { cn } from '@/lib/utils';
import {
  type VehiculeAvecPosition,
  getStatutVehicule,
} from '@/hooks/queries/useFlotte';

const statutDisplay: Record<string, { label: string; color: string; dot: string }> = {
  en_route: { label: 'En route', color: 'text-green', dot: 'bg-green' },
  stationne: { label: 'Stationne', color: 'text-blue-400', dot: 'bg-blue-400' },
  attention: { label: 'Attention', color: 'text-amber', dot: 'bg-amber' },
  hors_service: { label: 'Hors service', color: 'text-dim', dot: 'bg-gray-500' },
};

function tempsDepuis(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'a l\'instant';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

interface Props {
  vehicules: VehiculeAvecPosition[];
  vehiculeActif: string | null;
  onSelect: (id: string) => void;
  onDetail: (id: string) => void;
}

export function ListeVehicules({ vehicules, vehiculeActif, onSelect, onDetail }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] text-dim uppercase tracking-wider px-3 py-2">
        {vehicules.length} vehicule{vehicules.length > 1 ? 's' : ''}
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
        {vehicules.map((v) => {
          const pos = v.derniere_position;
          const statut = getStatutVehicule(pos, v);
          const s = statutDisplay[statut] ?? statutDisplay.stationne;
          const isActive = vehiculeActif === v.id;

          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              onDoubleClick={() => onDetail(v.id)}
              className={cn(
                'w-full text-left bg-bg-deep border rounded-xl p-3 transition-all',
                isActive
                  ? 'border-nikito-cyan/40 bg-nikito-cyan/5'
                  : 'border-white/[0.06] hover:border-white/[0.12]'
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className={cn('w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0', s.dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-medium truncate">{v.libelle}</div>
                    <span className={cn('text-[10px] font-medium flex-shrink-0', s.color)}>
                      {s.label}
                    </span>
                  </div>
                  {v.immatriculation && (
                    <div className="text-[11px] text-dim mt-0.5">{v.immatriculation}</div>
                  )}
                  {pos?.adresse && (
                    <div className="text-[11px] text-faint mt-1 truncate">{pos.adresse}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {pos?.vitesse != null && pos.vitesse > 0 && (
                      <span className="text-[10px] text-green">{pos.vitesse} km/h</span>
                    )}
                    {pos?.batterie_tracker != null && (
                      <span className={cn(
                        'text-[10px]',
                        pos.batterie_tracker < 20 ? 'text-amber' : 'text-faint'
                      )}>
                        Bat. {pos.batterie_tracker}%
                      </span>
                    )}
                    {pos && (
                      <span className="text-[10px] text-faint">
                        {tempsDepuis(pos.enregistre_le)}
                      </span>
                    )}
                    {v.assignee && (
                      <span className="text-[10px] text-faint ml-auto truncate max-w-[80px]">
                        {v.assignee.prenom} {v.assignee.nom?.charAt(0)}.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {vehicules.length === 0 && (
          <div className="text-center py-8 text-dim text-[12px]">
            Aucun vehicule trouve
          </div>
        )}
      </div>
    </div>
  );
}
