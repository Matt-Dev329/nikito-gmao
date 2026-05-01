import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useConformiteKpi, useParcsPhaseActuelle, usePrescriptions, useCommissions } from '@/hooks/queries/useConformite';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PhaseBadge } from './PhaseBadge';

export function PageConformite() {
  const navigate = useNavigate();
  const { data: kpi } = useConformiteKpi();
  const { data: phases } = useParcsPhaseActuelle();
  const { data: prescriptions } = usePrescriptions();
  const { data: commissions } = useCommissions();
  const { data: parcs } = useQuery({
    queryKey: ['conformite', 'parcs-liste'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parcs').select('id, code, nom, actif').eq('actif', true).order('code');
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Conformite ERP</h1>
          <p className="text-[13px] text-dim mt-0.5 capitalize">{today}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/gmao/conformite/commissions')}
            className="bg-gradient-cta text-bg-app px-4 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] hover:opacity-90 transition-opacity"
          >
            + Nouvelle commission
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard
          label="Parcs en exploitation"
          value={kpi?.parcsExploitation ?? 0}
          color="text-green"
        />
        <KpiCard
          label="Reserves ouvertes"
          value={kpi?.reservesOuvertes ?? 0}
          color="text-amber"
        />
        <KpiCard
          label="Reserves en retard"
          value={kpi?.reservesRetard ?? 0}
          color={kpi?.reservesRetard && kpi.reservesRetard > 0 ? 'text-red' : 'text-dim'}
          alert={!!kpi?.reservesRetard && kpi.reservesRetard > 0}
        />
        <KpiCard
          label="Prochaine commission"
          value={kpi?.prochaineCommission ? formatDate(kpi.prochaineCommission) : '—'}
          color="text-nikito-cyan"
          isText
        />
      </div>

      {/* Grid de cartes parcs */}
      <h2 className="text-[15px] font-semibold mb-4">Parcs</h2>
      {!parcs || parcs.length === 0 ? (
        <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
          <p className="text-dim text-sm">Aucun parc actif</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {parcs.map((parc) => {
            const phase = phases?.find((p) => p.parc_id === parc.id);
            const parcPrescriptions = prescriptions?.filter((p) => p.parc_id === parc.id && ['a_lever', 'en_cours'].includes(p.statut)) ?? [];
            const bloquantes = parcPrescriptions.filter((p) => p.gravite === 'bloquante').length;
            const retard = parcPrescriptions.filter((p) => p.delai_levee && p.delai_levee < new Date().toISOString().slice(0, 10)).length;
            const prochaineComm = commissions
              ?.filter((c) => c.parc_id === parc.id && c.date_visite >= new Date().toISOString().slice(0, 10))
              .sort((a, b) => a.date_visite.localeCompare(b.date_visite))[0];

            return (
              <button
                key={parc.id}
                onClick={() => navigate(`/gmao/parcs/${parc.id}`)}
                className="bg-bg-card rounded-xl p-4 border border-white/[0.06] hover:border-nikito-cyan/30 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold font-mono bg-nikito-cyan/10 text-nikito-cyan px-2 py-0.5 rounded">
                      {parc.code}
                    </span>
                    <span className="text-[14px] font-medium truncate">{parc.nom}</span>
                  </div>
                  {phase && <PhaseBadge phase={phase.phase} />}
                </div>

                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-dim">Reserves ouvertes</span>
                    <span className={cn(bloquantes > 0 ? 'text-red font-semibold' : 'text-text')}>
                      {parcPrescriptions.length}{bloquantes > 0 && ` (${bloquantes} bloquantes)`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dim">Prochaine commission</span>
                    <span className="text-text">{prochaineComm ? formatDate(prochaineComm.date_visite) : '—'}</span>
                  </div>
                </div>

                {(retard > 0 || (prochaineComm && isImminent(prochaineComm.date_visite))) && (
                  <div className="mt-3 pt-2 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                    {retard > 0 && (
                      <span className="text-[10px] font-bold bg-red/15 text-red px-2 py-0.5 rounded">
                        {retard} reserve{retard > 1 ? 's' : ''} en retard
                      </span>
                    )}
                    {prochaineComm && isImminent(prochaineComm.date_visite) && (
                      <span className="text-[10px] font-bold bg-amber/15 text-amber px-2 py-0.5 rounded">
                        Commission imminente
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, alert, isText }: { label: string; value: number | string; color: string; alert?: boolean; isText?: boolean }) {
  return (
    <div className={cn('bg-bg-card rounded-xl p-4 border', alert ? 'border-red/30' : 'border-white/[0.06]')}>
      <div className="text-[10px] text-dim uppercase tracking-wider mb-1.5">{label}</div>
      <div className={cn(isText ? 'text-[14px]' : 'text-2xl', 'font-bold', color)}>{value}</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isImminent(dateStr: string): boolean {
  const diff = new Date(dateStr + 'T00:00:00').getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}
