import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import {
  type VehiculeAvecPosition,
  getStatutVehicule,
  useParcs,
} from '@/hooks/queries/useFlotte';

const FALLBACK_CENTER: [number, number] = [48.85, 2.35];
const DEFAULT_ZOOM = 10;

const statutColors: Record<string, string> = {
  en_route: '#22c55e',
  stationne: '#3b82f6',
  attention: '#f59e0b',
  hors_service: '#6b7280',
};

function createVehicleIcon(statut: string) {
  const color = statutColors[statut] ?? '#6b7280';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="16" cy="15" r="7" fill="#fff" opacity="0.95"/>
    <path d="M11 17h10l-1-5h-2l-1-2h-2l-1 2h-2l-1 5z" fill="${color}" opacity="0.9"/>
    <circle cx="12.5" cy="17.5" r="1" fill="${color}"/>
    <circle cx="19.5" cy="17.5" r="1" fill="${color}"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

function createParcIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <rect x="2" y="2" width="24" height="24" rx="6" fill="#0B0B2E" stroke="#5DE5FF" stroke-width="1.5"/>
    <path d="M8 20V12l6-4 6 4v8" stroke="#5DE5FF" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M12 20v-4h4v4" stroke="#5DE5FF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function tempsDepuis(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'a l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

interface RecenterProps {
  vehiculeId: string | null;
  vehicules: VehiculeAvecPosition[];
}

function RecenterMap({ vehiculeId, vehicules }: RecenterProps) {
  const map = useMap();

  useEffect(() => {
    if (!vehiculeId) return;
    const v = vehicules.find((x) => x.id === vehiculeId);
    if (v?.derniere_position) {
      map.flyTo([v.derniere_position.latitude, v.derniere_position.longitude], 15, { duration: 0.8 });
    }
  }, [vehiculeId, vehicules, map]);

  return null;
}

interface Props {
  vehicules: VehiculeAvecPosition[];
  vehiculeFocus: string | null;
  onSelectVehicule: (id: string) => void;
  onDetailVehicule: (id: string) => void;
}

export function CarteFlotte({ vehicules, vehiculeFocus, onSelectVehicule, onDetailVehicule }: Props) {
  const parcIcon = useRef(createParcIcon());
  const { data: parcs } = useParcs();

  const parcsAvecCoords = useMemo(
    () => (parcs ?? []).filter((p) => p.latitude != null && p.longitude != null),
    [parcs],
  );

  const center = useMemo<[number, number]>(() => {
    if (parcsAvecCoords.length === 0) return FALLBACK_CENTER;
    const sumLat = parcsAvecCoords.reduce((s, p) => s + (p.latitude ?? 0), 0);
    const sumLng = parcsAvecCoords.reduce((s, p) => s + (p.longitude ?? 0), 0);
    return [sumLat / parcsAvecCoords.length, sumLng / parcsAvecCoords.length];
  }, [parcsAvecCoords]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-white/[0.06]">
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full z-0"
        style={{ background: '#0B0B2E' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <RecenterMap vehiculeId={vehiculeFocus} vehicules={vehicules} />

        {parcsAvecCoords.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude as number, p.longitude as number]}
            icon={parcIcon.current}
          >
            <Popup className="leaflet-popup-dark">
              <div className="text-[12px]">
                <div className="font-semibold">{p.nom}</div>
                <div className="text-gray-400 text-[11px]">{p.code}{p.ville ? ` - ${p.ville}` : ''}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {vehicules.map((v) => {
          const pos = v.derniere_position;
          if (!pos) return null;
          const statut = getStatutVehicule(pos, v);
          const icon = createVehicleIcon(statut);

          return (
            <Marker
              key={v.id}
              position={[pos.latitude, pos.longitude]}
              icon={icon}
              eventHandlers={{ click: () => onSelectVehicule(v.id) }}
            >
              <Popup className="leaflet-popup-dark">
                <div className="text-[12px] min-w-[180px]">
                  <div className="font-semibold text-[13px] mb-1">{v.libelle}</div>
                  {v.immatriculation && (
                    <div className="text-gray-400 text-[11px] mb-1.5">{v.immatriculation}</div>
                  )}
                  {pos.adresse && (
                    <div className="text-[11px] mb-1">{pos.adresse}</div>
                  )}
                  {pos.vitesse > 0 && (
                    <div className="text-[11px] text-green-400">{pos.vitesse} km/h</div>
                  )}
                  <div className="text-[10px] text-gray-500 mt-1">
                    {tempsDepuis(pos.enregistre_le)}
                    {pos.batterie_tracker != null && (
                      <span className={cn('ml-2', pos.batterie_tracker < 20 ? 'text-amber-400' : '')}>
                        Bat. {pos.batterie_tracker}%
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDetailVehicule(v.id); }}
                    className="mt-2 text-[11px] text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Voir le detail
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
