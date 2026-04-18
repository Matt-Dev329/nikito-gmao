import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  useHypothesesIA,
  useNotificationsStats,
  useRapportsIA,
  useGenererRapportIA,
  type HypotheseIA,
} from '@/hooks/queries/useNotificationsIA';
import { useMaintenanceData } from '@/hooks/queries/useMaintenanceData';
import { useAnalyseIA } from '@/hooks/queries/useAnalyseIA';
import { CarteHypothese } from './CarteHypothese';
import { ModaleValiderHypothese } from './ModaleValiderHypothese';

type FiltreStatut = 'tous' | 'en_attente' | 'validee' | 'rejetee';
type FiltreType = 'tous' | 'equipement_risque' | 'alerte' | 'recommandation';

const filtresStatut: { value: FiltreStatut; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'validee', label: 'Validees' },
  { value: 'rejetee', label: 'Rejetees' },
];

const filtresType: { value: FiltreType; label: string }[] = [
  { value: 'tous', label: 'Tous types' },
  { value: 'equipement_risque', label: 'Equipements' },
  { value: 'alerte', label: 'Alertes' },
  { value: 'recommandation', label: 'Recommandations' },
];

export function PageNotificationsIA() {
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('en_attente');
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [hypotheseActive, setHypotheseActive] = useState<HypotheseIA | null>(null);
  const [rapportSelectionne, setRapportSelectionne] = useState<string | undefined>();

  const { data: stats } = useNotificationsStats();
  const { data: hypotheses, isLoading } = useHypothesesIA(rapportSelectionne);
  const { data: rapports } = useRapportsIA();
  const { data: maintenanceData } = useMaintenanceData();
  const { analyse } = useAnalyseIA();
  const { mutate: generer, isPending: generationEnCours } = useGenererRapportIA();

  const hypothesesFiltrees = useMemo(() => {
    if (!hypotheses) return [];
    return hypotheses.filter((h) => {
      if (filtreStatut !== 'tous' && h.statut !== filtreStatut) return false;
      if (filtreType !== 'tous' && h.type !== filtreType) return false;
      return true;
    });
  }, [hypotheses, filtreStatut, filtreType]);

  const handleGenerer = () => {
    if (!analyse) return;
    generer(analyse);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[18px] font-semibold flex items-center gap-2.5">
            <BellIcon className="w-5 h-5 text-nikito-cyan" />
            Notifications IA
          </div>
          <div className="text-[11px] text-dim mt-0.5">
            Hypotheses de l'IA predictive a valider ou rejeter chaque semaine
          </div>
        </div>
        <button
          onClick={handleGenerer}
          disabled={!analyse || generationEnCours || !maintenanceData}
          className={cn(
            'bg-gradient-cta text-text px-4 py-2.5 rounded-lg text-[12px] font-medium min-h-[44px] hover:brightness-110 transition-all flex items-center gap-2',
            (!analyse || generationEnCours) && 'opacity-40 cursor-not-allowed'
          )}
        >
          <SparkIcon className="w-3.5 h-3.5" />
          {generationEnCours ? 'Generation...' : 'Generer le rapport de la semaine'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Total" value={stats?.total ?? 0} color="text-text" />
        <StatBox label="En attente" value={stats?.en_attente ?? 0} color="text-amber" />
        <StatBox label="Validees" value={stats?.validees ?? 0} color="text-green" />
        <StatBox label="Rejetees" value={stats?.rejetees ?? 0} color="text-red" />
      </div>

      {rapports && rapports.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setRapportSelectionne(undefined)}
            className={cn(
              'px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors min-h-[38px] border',
              !rapportSelectionne
                ? 'bg-nikito-cyan/10 border-nikito-cyan/30 text-nikito-cyan'
                : 'bg-white/[0.02] border-white/[0.06] text-dim hover:text-text'
            )}
          >
            Toutes les semaines
          </button>
          {rapports.slice(0, 8).map((r) => (
            <button
              key={r.id}
              onClick={() => setRapportSelectionne(r.id === rapportSelectionne ? undefined : r.id)}
              className={cn(
                'px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors min-h-[38px] border flex items-center gap-1.5',
                r.id === rapportSelectionne
                  ? 'bg-nikito-cyan/10 border-nikito-cyan/30 text-nikito-cyan'
                  : 'bg-white/[0.02] border-white/[0.06] text-dim hover:text-text'
              )}
            >
              <span className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                r.score_sante >= 80 ? 'bg-green' : r.score_sante >= 50 ? 'bg-amber' : 'bg-red'
              )} />
              S{r.semaine_iso.split('-W')[1]} - {r.score_sante}/100
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex gap-1.5 bg-bg-deep rounded-lg p-1">
          {filtresStatut.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltreStatut(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors min-h-[32px]',
                filtreStatut === f.value
                  ? 'bg-white/[0.08] text-text'
                  : 'text-dim hover:text-text'
              )}
            >
              {f.label}
              {f.value === 'en_attente' && stats?.en_attente ? (
                <span className="ml-1 text-[10px] text-amber font-semibold">{stats.en_attente}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-bg-deep rounded-lg p-1">
          {filtresType.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltreType(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors min-h-[32px]',
                filtreType === f.value
                  ? 'bg-white/[0.08] text-text'
                  : 'text-dim hover:text-text'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white/[0.04] rounded-xl h-[90px]" />
          ))}
        </div>
      ) : hypothesesFiltrees.length === 0 ? (
        <EmptyState filtreStatut={filtreStatut} hasRapports={!!rapports?.length} />
      ) : (
        <div className="space-y-2.5">
          {hypothesesFiltrees.map((h) => (
            <CarteHypothese
              key={h.id}
              hypothese={h}
              onValider={setHypotheseActive}
            />
          ))}
        </div>
      )}

      {hypotheseActive && (
        <ModaleValiderHypothese
          hypothese={hypotheseActive}
          onClose={() => setHypotheseActive(null)}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-bg-card border border-white/[0.06] rounded-xl p-3.5 text-center">
      <div className={cn('text-[22px] font-bold', color)}>{value}</div>
      <div className="text-[10px] text-dim uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function EmptyState({ filtreStatut, hasRapports }: { filtreStatut: FiltreStatut; hasRapports: boolean }) {
  return (
    <div className="bg-bg-card border border-white/[0.06] rounded-xl p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-white/[0.04] mx-auto mb-3 flex items-center justify-center">
        <BellIcon className="w-6 h-6 text-dim" />
      </div>
      <div className="text-[14px] font-medium mb-1">
        {!hasRapports
          ? 'Aucun rapport genere'
          : filtreStatut === 'en_attente'
            ? 'Aucune hypothese en attente'
            : 'Aucune hypothese trouvee'}
      </div>
      <div className="text-[12px] text-dim max-w-[300px] mx-auto">
        {!hasRapports
          ? 'Lancez l\'analyse IA predictive puis cliquez sur "Generer le rapport de la semaine" pour creer des hypotheses a valider.'
          : 'Toutes les hypotheses ont ete traitees pour ce filtre.'}
      </div>
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2a5 5 0 0 0-5 5c0 4-2 5-2 5h14s-2-1-2-5a5 5 0 0 0-5-5" />
      <path d="M8.5 15a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v4l3-1-3 5v-4l-3 1 3-5z" />
      <circle cx="8" cy="8" r="7" />
    </svg>
  );
}
