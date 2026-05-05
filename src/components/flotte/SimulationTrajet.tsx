import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useInsererPosition } from '@/hooks/queries/useFlotte';

const TRAJET = [
  { lat: 48.8665, lng: 2.4869, speed: 0, addr: 'Depart DOM - Rosny-sous-Bois' },
  { lat: 48.8891, lng: 2.4512, speed: 55, addr: 'A86 - Bobigny / Drancy' },
  { lat: 48.9215, lng: 2.4038, speed: 75, addr: 'A86 - Stains' },
  { lat: 48.9358, lng: 2.3472, speed: 90, addr: 'A1 - Saint-Denis Universite' },
  { lat: 48.9547, lng: 2.3032, speed: 95, addr: 'A15 - Argenteuil' },
  { lat: 48.9702, lng: 2.2651, speed: 80, addr: 'A15 - Sannois / Ermont' },
  { lat: 48.9823, lng: 2.2421, speed: 50, addr: 'Sortie Franconville' },
  { lat: 48.9876, lng: 2.2298, speed: 0, addr: 'Arrivee FRA - Nikito Franconville' },
];

interface Props {
  vehiculeId: string | undefined;
}

export function SimulationTrajet({ vehiculeId }: Props) {
  const [enCours, setEnCours] = useState(false);
  const [etape, setEtape] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mutate: inserer } = useInsererPosition();

  const lancerSimulation = useCallback(() => {
    if (!vehiculeId || enCours) return;
    setEnCours(true);
    setEtape(0);

    let i = 0;
    const next = () => {
      if (i >= TRAJET.length) {
        setEnCours(false);
        return;
      }
      const point = TRAJET[i];
      setEtape(i);
      inserer({
        vehicule_id: vehiculeId,
        latitude: point.lat,
        longitude: point.lng,
        vitesse: point.speed,
        moteur_allume: point.speed > 0,
        adresse: point.addr,
        batterie_tracker: 72 - i,
        cap: null,
        altitude: null,
      });
      i++;
      timerRef.current = setTimeout(next, 5000);
    };
    next();
  }, [vehiculeId, enCours, inserer]);

  const arreter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setEnCours(false);
    setEtape(0);
  };

  if (!vehiculeId) return null;

  return (
    <div className="flex items-center gap-2">
      {!enCours ? (
        <button
          onClick={lancerSimulation}
          className="bg-nikito-cyan/10 border border-nikito-cyan/30 text-nikito-cyan px-3 py-2 rounded-lg text-[11px] font-medium min-h-[38px] hover:bg-nikito-cyan/20 transition-colors flex items-center gap-1.5"
        >
          <PlayIcon className="w-3.5 h-3.5" />
          Simuler un trajet
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="bg-green/10 border border-green/30 rounded-lg px-3 py-2 text-[11px] text-green font-medium flex items-center gap-2 min-h-[38px]">
            <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
            Simulation {etape + 1}/{TRAJET.length}
            <span className="text-[10px] text-green/70">{TRAJET[etape]?.addr}</span>
          </div>
          <button
            onClick={arreter}
            className={cn(
              'border border-red/30 text-red px-3 py-2 rounded-lg text-[11px] font-medium min-h-[38px] hover:bg-red/10 transition-colors'
            )}
          >
            Arreter
          </button>
        </div>
      )}
    </div>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  );
}
