import { useMemo, useRef, useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import { cn } from '@/lib/utils';
import {
  type VehiculeAvecPosition,
  type VehiculePosition,
  getStatutVehicule,
  useHistoriquePositions,
  useModifierVehicule,
} from '@/hooks/queries/useFlotte';

const statutDisplay: Record<string, { label: string; color: string }> = {
  en_route: { label: 'En route', color: 'text-green' },
  stationne: { label: 'Stationne', color: 'text-blue-400' },
  attention: { label: 'Attention batterie', color: 'text-amber' },
  hors_service: { label: 'Hors service', color: 'text-dim' },
};

function createSmallIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="26" viewBox="0 0 20 26">
    <path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 16 10 16s10-8.5 10-16C20 4.5 15.5 0 10 0z" fill="${color}" stroke="#fff" stroke-width="1"/>
    <circle cx="10" cy="9.5" r="4" fill="#fff" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [20, 26],
    iconAnchor: [10, 26],
  });
}

interface Props {
  vehicule: VehiculeAvecPosition;
  onClose: () => void;
}

export function ModaleDetailVehicule({ vehicule, onClose }: Props) {
  const pos = vehicule.derniere_position;
  const statut = getStatutVehicule(pos, vehicule);
  const s = statutDisplay[statut] ?? statutDisplay.stationne;
  const { data: historique } = useHistoriquePositions(vehicule.id, 50);
  const { mutate: modifier, isPending } = useModifierVehicule();
  const mapRef = useRef<L.Map | null>(null);

  const positions: [number, number][] = useMemo(() => {
    if (!historique) return [];
    return historique
      .slice()
      .reverse()
      .map((p: VehiculePosition) => [p.latitude, p.longitude] as [number, number]);
  }, [historique]);

  const center: [number, number] = pos
    ? [pos.latitude, pos.longitude]
    : [48.85, 2.35];

  useEffect(() => {
    if (mapRef.current && positions.length > 1) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => L.latLng(lat, lng)));
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [positions]);

  const handleMaintenance = () => {
    const newStatut = vehicule.statut === 'maintenance' ? 'actif' : 'maintenance';
    modifier({ id: vehicule.id, statut: newStatut } as Parameters<typeof modifier>[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl max-w-[680px] w-full border border-white/[0.08] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 pb-0 flex justify-between items-start">
          <div>
            <div className="text-[10px] text-dim uppercase tracking-wider mb-0.5">
              {vehicule.code}
            </div>
            <div className="text-[18px] font-semibold">{vehicule.libelle}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-[11px] font-medium', s.color)}>{s.label}</span>
              {vehicule.immatriculation && (
                <span className="text-[11px] text-dim">{vehicule.immatriculation}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex-shrink-0"
          >
            x
          </button>
        </div>

        <div className="h-[220px] mx-5 mt-4 rounded-xl overflow-hidden border border-white/[0.06]">
          <MapContainer
            center={center}
            zoom={14}
            className="w-full h-full z-0"
            style={{ background: '#0B0B2E' }}
            zoomControl={false}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {pos && (
              <Marker position={[pos.latitude, pos.longitude]} icon={createSmallIcon('#5DE5FF')} />
            )}
            {positions.length > 1 && (
              <Polyline
                positions={positions}
                pathOptions={{ color: '#5DE5FF', weight: 2.5, opacity: 0.7 }}
              />
            )}
          </MapContainer>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoBox label="Marque" value={vehicule.marque ?? '-'} />
            <InfoBox label="Modele" value={vehicule.modele ?? '-'} />
            <InfoBox label="Km actuel" value={vehicule.km_actuel ? `${vehicule.km_actuel.toLocaleString('fr-FR')} km` : '-'} />
            <InfoBox
              label="Batterie tracker"
              value={pos?.batterie_tracker != null ? `${pos.batterie_tracker}%` : '-'}
              color={pos?.batterie_tracker != null && pos.batterie_tracker < 20 ? 'text-amber' : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoBox
              label="Derniere revision"
              value={vehicule.date_derniere_revision ? new Date(vehicule.date_derniere_revision).toLocaleDateString('fr-FR') : '-'}
            />
            <InfoBox
              label="Prochaine revision"
              value={vehicule.date_prochaine_revision ? new Date(vehicule.date_prochaine_revision).toLocaleDateString('fr-FR') : '-'}
              color={vehicule.date_prochaine_revision && new Date(vehicule.date_prochaine_revision) < new Date() ? 'text-red' : undefined}
            />
          </div>

          {vehicule.assignee && (
            <div className="text-[12px] text-dim">
              Assigne a : <span className="text-text">{vehicule.assignee.prenom} {vehicule.assignee.nom}</span>
            </div>
          )}

          {historique && historique.length > 0 && (
            <div>
              <div className="text-[10px] text-dim uppercase tracking-wider mb-2">
                Dernieres positions ({historique.length})
              </div>
              <div className="max-h-[150px] overflow-y-auto space-y-1">
                {historique.slice(0, 20).map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-[11px] py-1 border-b border-white/[0.04]">
                    <span className="text-faint w-[100px] flex-shrink-0">
                      {new Date(h.enregistre_le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-dim truncate flex-1">{h.adresse ?? `${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}`}</span>
                    {h.vitesse > 0 && <span className="text-green flex-shrink-0">{h.vitesse} km/h</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2.5 justify-end pt-2">
            <button
              onClick={handleMaintenance}
              disabled={isPending}
              className={cn(
                'border border-amber/30 text-amber px-4 py-2.5 rounded-[10px] text-[12px] font-medium min-h-[44px] hover:bg-amber/10 transition-colors',
                isPending && 'opacity-40'
              )}
            >
              {vehicule.statut === 'maintenance' ? 'Remettre en service' : 'Mettre en maintenance'}
            </button>
            <button
              onClick={onClose}
              className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-bg-deep rounded-lg p-2.5">
      <div className="text-[10px] text-dim uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn('text-[13px] font-medium', color ?? 'text-text')}>{value}</div>
    </div>
  );
}
