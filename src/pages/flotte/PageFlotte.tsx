import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  useVehiculesAvecPositions,
  getStatutVehicule,
  type FiltreStatutVehicule,
  type VehiculeAvecPosition,
} from '@/hooks/queries/useFlotte';
import { useFormation } from '@/hooks/useFormation';
import { CarteFlotte } from '@/components/flotte/CarteFlotte';
import { ListeVehicules } from '@/components/flotte/ListeVehicules';
import { ModaleAjouterVehicule } from '@/components/flotte/ModaleAjouterVehicule';
import { ModaleDetailVehicule } from '@/components/flotte/ModaleDetailVehicule';
import { SimulationTrajet } from '@/components/flotte/SimulationTrajet';

const filtresStatut: { value: FiltreStatutVehicule; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'en_route', label: 'En route' },
  { value: 'stationne', label: 'Stationne' },
  { value: 'hors_service', label: 'HS' },
  { value: 'sans_tracker', label: 'Sans tracker' },
];

export function PageFlotte() {
  const [filtre, setFiltre] = useState<FiltreStatutVehicule>('tous');
  const [recherche, setRecherche] = useState('');
  const [vehiculeFocus, setVehiculeFocus] = useState<string | null>(null);
  const [vehiculeDetail, setVehiculeDetail] = useState<VehiculeAvecPosition | null>(null);
  const [modaleAjouter, setModaleAjouter] = useState(false);
  const [panneauOuvert, setPanneauOuvert] = useState(true);

  const { data: vehicules, isLoading } = useVehiculesAvecPositions();
  const formationActive = useFormation((s) => s.active);

  const vehiculeSimulation = useMemo(() => {
    if (vehiculeFocus) {
      const v = vehicules.find((x) => x.id === vehiculeFocus);
      if (v && v.statut === 'actif') return v;
    }
    return vehicules.find((v) => v.statut === 'actif');
  }, [vehicules, vehiculeFocus]);

  const vehiculesFiltres = useMemo(() => {
    let result = vehicules;

    if (filtre !== 'tous') {
      result = result.filter((v) => {
        if (filtre === 'sans_tracker') {
          return !v.tracker_type || v.tracker_type === 'aucun';
        }
        const s = getStatutVehicule(v.derniere_position, v);
        if (filtre === 'en_route') return s === 'en_route';
        if (filtre === 'stationne') return s === 'stationne' || s === 'attention';
        if (filtre === 'hors_service') return s === 'hors_service';
        return true;
      });
    }

    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter(
        (v) =>
          v.libelle.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          (v.immatriculation && v.immatriculation.toLowerCase().includes(q))
      );
    }

    return result;
  }, [vehicules, filtre, recherche]);

  const handleSelectVehicule = (id: string) => {
    setVehiculeFocus((prev) => (prev === id ? null : id));
  };

  const handleDetailVehicule = (id: string) => {
    const v = vehicules.find((x) => x.id === id);
    if (v) setVehiculeDetail(v);
  };

  const compteurs = useMemo(() => {
    const c = { en_route: 0, stationne: 0, hors_service: 0 };
    for (const v of vehicules) {
      const s = getStatutVehicule(v.derniere_position, v);
      if (s === 'en_route') c.en_route++;
      else if (s === 'hors_service') c.hors_service++;
      else c.stationne++;
    }
    return c;
  }, [vehicules]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] flex-wrap">
        <div className="flex items-center gap-2.5 mr-auto min-w-0">
          <TruckIcon className="w-5 h-5 text-nikito-cyan flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold truncate">Flotte</div>
            <div className="text-[10px] text-dim">
              {vehicules.length} vehicule{vehicules.length > 1 ? 's' : ''}
              {compteurs.en_route > 0 && <span className="text-green ml-1.5">{compteurs.en_route} en route</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-bg-deep rounded-lg p-0.5">
          {filtresStatut.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltre(f.value)}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors min-h-[30px]',
                filtre === f.value
                  ? 'bg-white/[0.08] text-text'
                  : 'text-dim hover:text-text'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher..."
            className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-1.5 text-text text-[12px] outline-none focus:border-nikito-cyan w-[160px] min-h-[30px]"
          />
        </div>

        <button
          onClick={() => setModaleAjouter(true)}
          className="bg-gradient-cta text-text px-3 py-1.5 rounded-lg text-[11px] font-medium min-h-[30px] hover:brightness-110 transition-all flex items-center gap-1.5"
        >
          <span className="text-[14px] leading-none">+</span>
          Ajouter
        </button>

        <button
          onClick={() => setPanneauOuvert((p) => !p)}
          className="md:hidden bg-bg-deep border border-white/[0.08] text-dim px-2.5 py-1.5 rounded-lg text-[11px] min-h-[30px]"
        >
          {panneauOuvert ? 'Carte' : 'Liste'}
        </button>

        {formationActive && (
          <SimulationTrajet vehiculeId={vehiculeSimulation?.id} />
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-dim text-[13px]">Chargement de la flotte...</div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className={cn(
            'flex-1 p-3',
            panneauOuvert ? 'hidden md:block' : 'block'
          )}>
            <CarteFlotte
              vehicules={vehiculesFiltres}
              vehiculeFocus={vehiculeFocus}
              onSelectVehicule={handleSelectVehicule}
              onDetailVehicule={handleDetailVehicule}
            />
          </div>

          <div className={cn(
            'border-l border-white/[0.06] bg-bg-card overflow-hidden flex flex-col',
            panneauOuvert ? 'w-full md:w-[360px]' : 'hidden md:flex md:w-[360px]'
          )}>
            <ListeVehicules
              vehicules={vehiculesFiltres}
              vehiculeActif={vehiculeFocus}
              onSelect={handleSelectVehicule}
              onDetail={handleDetailVehicule}
            />
          </div>
        </div>
      )}

      {modaleAjouter && (
        <ModaleAjouterVehicule onClose={() => setModaleAjouter(false)} />
      )}

      {vehiculeDetail && (
        <ModaleDetailVehicule
          vehicule={vehiculeDetail}
          onClose={() => setVehiculeDetail(null)}
        />
      )}
    </div>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="7" width="12" height="9" rx="1" />
      <path d="M13 10h4l2 3v3h-6" />
      <circle cx="5" cy="16" r="1.5" />
      <circle cx="16" cy="16" r="1.5" />
    </svg>
  );
}
