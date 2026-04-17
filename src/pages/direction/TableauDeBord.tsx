import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  ReferenceLine, Cell, PieChart, Pie, Cell as PieCell, Tooltip,
} from 'recharts';
import { KpiCard } from '@/components/kpi/KpiCard';
import { Pill } from '@/components/ui/Pill';
import { Card, CardHead } from '@/components/ui/Card';
import { CritTag } from '@/components/ui/CritTag';
import { formatDateLong, formatHeure, formatDuree } from '@/lib/utils';
import { kpiLabels } from '@/lib/tokens';
import {
  useKpiPerformance, useKpiMtbf, useKpiMttr,
  useKpiPremierCoup, useKpiPlaintes,
} from '@/hooks/queries/useKpi';
import { useIncidents } from '@/hooks/queries/useTickets';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useControlesOuvertureManquants } from '@/hooks/queries/useControlesManquants';
import type { Criticite } from '@/types/database';

type Periode = '7j' | '30j' | '90j';

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className ?? ''}`} />
  );
}

function KpiSkeleton() {
  return (
    <div className="bg-bg-card rounded-xl p-4 border-t-2 border-white/[0.06]">
      <SkeletonBlock className="h-3 w-24 mb-3" />
      <SkeletonBlock className="h-8 w-16 mb-2" />
      <SkeletonBlock className="h-3 w-32" />
    </div>
  );
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function fmtNum(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace('.', ',');
}

const CRIT_COLORS: Record<string, string> = {
  bloquant: '#FF4D6D',
  majeur: '#FFB547',
  mineur: '#5DE5FF',
};

const CRIT_LABELS: Record<string, string> = {
  bloquant: 'Bloquant',
  majeur: 'Majeur',
  mineur: 'Mineur',
};

const statutToneClass = {
  amber: 'text-amber',
  pink: 'text-nikito-pink',
  dim: 'text-dim',
};

function getStatutInfo(incident: Record<string, unknown>): { texte: string; tone: 'amber' | 'pink' | 'dim' } {
  const statut = incident.statut as string;
  const priorite = incident.niveaux_priorite as Record<string, unknown> | null;
  const slaH = (priorite?.sla_h as number) ?? 24;
  const declareLe = incident.declare_le as string;
  const elapsed = (Date.now() - new Date(declareLe).getTime()) / 3_600_000;

  if (elapsed > slaH) {
    return { texte: 'SLA dépassé · escalade', tone: 'amber' };
  }
  if (statut === 'assigne') {
    return { texte: 'Assigné', tone: 'dim' };
  }
  if (statut === 'en_cours') {
    return { texte: 'En cours', tone: 'dim' };
  }
  return { texte: 'Ouvert', tone: 'pink' };
}

function mapCriticite(priorite: Record<string, unknown> | null): Criticite {
  const code = (priorite?.code as string) ?? '';
  if (code === 'P1' || code === 'bloquant') return 'bloquant';
  if (code === 'P2' || code === 'majeur') return 'majeur';
  return 'mineur';
}

export function TableauDeBord() {
  const [periode, setPeriode] = useState<Periode>('30j');
  const [parcActif, setParcActif] = useState<string | null>(null);

  const perfQ = useKpiPerformance();
  const mtbfQ = useKpiMtbf();
  const mttrQ = useKpiMttr();
  const premierCoupQ = useKpiPremierCoup();
  const plaintesQ = useKpiPlaintes();
  const parcsQ = useParcs();
  const incidentsQ = useIncidents({ statuts: ['ouvert', 'assigne', 'en_cours'] });
  const { data: controlesManquants } = useControlesOuvertureManquants();

  const kpiLoading = perfQ.isLoading || mtbfQ.isLoading || mttrQ.isLoading
    || premierCoupQ.isLoading || plaintesQ.isLoading;

  const perfData = useMemo(() => {
    if (!perfQ.data) return [];
    return perfQ.data.map((r: Record<string, unknown>) => ({
      parc: (r.parc_nom as string) ?? '',
      parc_id: r.parc_id as string,
      perf: (r.performance_pct as number) ?? 0,
    }));
  }, [perfQ.data]);

  const perfFiltered = parcActif
    ? perfData.filter((d) => d.parc_id === parcActif)
    : perfData;

  const kpiAgreg = useMemo(() => {
    const filterByParc = <T extends Record<string, unknown>>(data: T[] | undefined) => {
      if (!data) return [];
      if (!parcActif) return data;
      return data.filter((r) => r.parc_id === parcActif);
    };

    const perf = filterByParc(perfQ.data as Record<string, unknown>[] | undefined);
    const mtbf = filterByParc(mtbfQ.data as Record<string, unknown>[] | undefined);
    const mttr = filterByParc(mttrQ.data as Record<string, unknown>[] | undefined);
    const pc = filterByParc(premierCoupQ.data as Record<string, unknown>[] | undefined);
    const plaintes = filterByParc(plaintesQ.data as Record<string, unknown>[] | undefined);

    return {
      performance: fmtNum(avg(perf.map((r) => (r.performance_pct as number) ?? 0))),
      mtbf: fmtNum(avg(mtbf.map((r) => (r.mtbf_jours as number) ?? 0))),
      mttr: Math.round(avg(mttr.map((r) => (r.mttr_minutes as number) ?? 0))).toString(),
      premierCoup: Math.round(avg(pc.map((r) => (r.premier_coup_pct as number) ?? 0))).toString(),
      plaintes: sum(plaintes.map((r) => (r.plaintes_7j as number) ?? 0)).toString(),
    };
  }, [perfQ.data, mtbfQ.data, mttrQ.data, premierCoupQ.data, plaintesQ.data, parcActif]);

  const alertes = useMemo(() => {
    if (!incidentsQ.data) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filtered = incidentsQ.data as any[];
    if (parcActif) {
      filtered = filtered.filter((i) => i.equipements?.parc_id === parcActif);
    }
    const prioriteOrder = ['P1', 'P2', 'P3'];
    return filtered
      .sort((a, b) => {
        const aCode = a.niveaux_priorite?.code ?? 'P3';
        const bCode = b.niveaux_priorite?.code ?? 'P3';
        return prioriteOrder.indexOf(aCode) - prioriteOrder.indexOf(bCode);
      })
      .slice(0, 10);
  }, [incidentsQ.data, parcActif]);

  const critData = useMemo(() => {
    if (!incidentsQ.data) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filtered = incidentsQ.data as any[];
    if (parcActif) {
      filtered = filtered.filter((i) => i.equipements?.parc_id === parcActif);
    }
    const counts: Record<string, number> = { bloquant: 0, majeur: 0, mineur: 0 };
    filtered.forEach((i) => {
      const crit = mapCriticite(i.niveaux_priorite);
      counts[crit]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: CRIT_LABELS[name],
        value,
        color: CRIT_COLORS[name],
      }));
  }, [incidentsQ.data, parcActif]);

  const totalTickets = critData.reduce((s, d) => s + d.value, 0);
  const parcs = parcsQ.data ?? [];
  const now = new Date();

  return (
    <div className="p-4 md:p-6 md:px-7 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-[18px]">
        <div>
          <div className="text-[11px] text-dim tracking-[1.5px] uppercase mb-1">
            {formatDateLong(now)} · {formatHeure(now)}
          </div>
          <h1 className="text-xl md:text-2xl lg:text-[22px] font-semibold m-0">Pilotage temps réel</h1>
        </div>
        <div className="flex gap-2">
          {(['7j', '30j', '90j'] as Periode[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={
                periode === p
                  ? 'bg-gradient-cta text-text px-3.5 py-1.5 rounded-lg text-xs font-medium min-h-[44px] md:min-h-0'
                  : 'bg-bg-card border border-white/[0.08] text-text px-3.5 py-1.5 rounded-lg text-xs min-h-[44px] md:min-h-0'
              }
            >
              {p === '7j' ? '7 jours' : p === '30j' ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        <Pill active={parcActif === null} onClick={() => setParcActif(null)}>
          Tous les parcs
        </Pill>
        {parcs.map((p: Record<string, unknown>) => (
          <Pill
            key={p.id as string}
            active={parcActif === (p.id as string)}
            onClick={() => setParcActif(p.id as string)}
          >
            {p.code as string} · {p.nom as string}
          </Pill>
        ))}
      </div>

      {controlesManquants && controlesManquants.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {controlesManquants.map((cm) => (
            <div
              key={cm.parc_id}
              className="bg-red/10 border border-red/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-red flex items-center gap-2">
                  <span className="text-base">!</span>
                  CONTROLE NON FAIT
                </div>
                <div className="text-[12px] text-text mt-1">
                  Le controle d'ouverture de <strong>{cm.parc_nom}</strong> ({cm.parc_code}) n'a pas ete realise aujourd'hui.
                </div>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Le controle d'ouverture de ${cm.parc_nom} (${cm.parc_code}) n'a pas ete fait ce matin. Merci de verifier avec l'equipe sur place.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-transparent border border-red text-red px-4 py-2.5 rounded-lg text-[12px] font-semibold text-center min-h-[44px] flex items-center justify-center whitespace-nowrap self-start"
              >
                Contacter l'equipe
              </a>
            </div>
          ))}
        </div>
      )}

      {kpiLoading ? (
        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiSkeleton />
            <KpiSkeleton />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </div>
        </div>
      ) : (
        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiCard
              label={kpiLabels.performance}
              valeur={kpiAgreg.performance}
              unite="%"
              delta={{ texte: `moy. ${periode}`, tone: 'neutre' }}
              couleur="lime"
            />
            <KpiCard
              label={kpiLabels.plaintes}
              valeur={kpiAgreg.plaintes}
              delta={{ texte: '7 derniers jours', tone: 'neutre' }}
              couleur="amber"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard
              label={kpiLabels.mtbf}
              valeur={kpiAgreg.mtbf}
              unite=" j"
              delta={{ texte: `moy. ${periode}`, tone: 'neutre' }}
              couleur="cyan"
              compact
            />
            <KpiCard
              label={kpiLabels.mttr}
              valeur={kpiAgreg.mttr}
              unite=" min"
              delta={{ texte: `moy. ${periode}`, tone: 'neutre' }}
              couleur="violet"
              compact
            />
            <KpiCard
              label={kpiLabels.premierCoup}
              valeur={kpiAgreg.premierCoup}
              unite="%"
              delta={{ texte: `cible 90% · ${periode}`, tone: 'neutre' }}
              couleur="green"
              compact
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3.5 mb-[18px]">
        <Card>
          <CardHead titre={`Performance par parc · ${periode === '7j' ? '7' : periode === '30j' ? '30' : '90'} derniers jours`} meta="% disponibilité bloquants" />
          <div className="h-[200px]">
            {perfQ.isLoading ? (
              <div className="flex items-center justify-center h-full">
                <SkeletonBlock className="h-[160px] w-full" />
              </div>
            ) : perfFiltered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-dim text-sm">
                Aucune donnée
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfFiltered} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                  <XAxis dataKey="parc" axisLine={false} tickLine={false} tick={{ fill: '#A8A8C8', fontSize: 11 }} />
                  <YAxis domain={[80, 100]} axisLine={false} tickLine={false} tick={{ fill: '#A8A8C8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <ReferenceLine y={95} stroke="#5DE5FF" strokeDasharray="6 4" />
                  <Bar dataKey="perf" radius={[6, 6, 0, 0]}>
                    {perfFiltered.map((d) => (
                      <Cell key={d.parc} fill={d.perf >= 95 ? '#D4F542' : '#FFB547'} />
                    ))}
                  </Bar>
                  <Tooltip
                    contentStyle={{ background: '#0D0D38', border: '1px solid #2A2A5A', borderRadius: 8, color: '#fff', fontSize: 12 }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(value: number) => [`${fmtNum(value)}%`, 'Performance']}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHead titre="Tickets par criticité · 7j" meta={`${totalTickets} au total`} />
          <div className="h-[200px] flex items-center gap-4">
            {incidentsQ.isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <SkeletonBlock className="h-[150px] w-[150px] rounded-full" />
              </div>
            ) : critData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-dim text-sm">
                Aucun ticket
              </div>
            ) : (
              <>
                <div className="flex-1 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={critData} dataKey="value" innerRadius={48} outerRadius={75} stroke="#151547" strokeWidth={3}>
                        {critData.map((d) => (
                          <PieCell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5 text-[11px] pr-1">
                  {critData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-dim">{d.name}</span>
                      <span className="font-medium ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          titre="Alertes en cours · à arbitrer"
          meta={`${alertes.length} active${alertes.length > 1 ? 's' : ''}`}
          metaTone={alertes.length > 0 ? 'red' : 'default'}
        />
        {incidentsQ.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : alertes.length === 0 ? (
          <div className="text-dim text-sm py-6 text-center">Aucune alerte en cours</div>
        ) : (
          <div className="flex flex-col gap-2">
            {alertes.map((a: Record<string, unknown>) => {
              const priorite = a.niveaux_priorite as Record<string, unknown> | null;
              const equip = a.equipements as Record<string, unknown>;
              const parc = equip?.parcs as Record<string, unknown> | null;
              const zone = equip?.zones as Record<string, unknown> | null;
              const criticite = mapCriticite(priorite);
              const statutInfo = getStatutInfo(a);
              const declareLe = a.declare_le as string;

              return (
                <div
                  key={a.numero_bt as string}
                  className={`md:hidden flex flex-col gap-2 px-3.5 py-3 bg-bg-deep rounded-lg border-l-[3px] ${
                    criticite === 'bloquant' ? 'border-l-red' : 'border-l-amber'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CritTag niveau={criticite} />
                    <span className={`text-[11px] ${statutToneClass[statutInfo.tone]}`}>{statutInfo.texte}</span>
                    <span className="text-[11px] text-dim ml-auto">{formatDuree(declareLe)}</span>
                  </div>
                  <div className="text-[13px] font-medium">
                    {equip?.libelle as string ?? equip?.code as string ?? 'N/A'}
                  </div>
                  <div className="text-[11px] text-dim">
                    {parc?.code as string ?? ''} · {parc?.nom as string ?? ''}{zone ? ` · ${zone.nom as string}` : ''}
                  </div>
                  <button className="bg-transparent border border-nikito-cyan text-nikito-cyan px-2.5 py-2 rounded-md text-[11px] min-h-[44px] self-start">
                    Ouvrir
                  </button>
                </div>
              );
            })}

            <table className="hidden md:table w-full">
              <tbody>
                {alertes.map((a: Record<string, unknown>) => {
                  const priorite = a.niveaux_priorite as Record<string, unknown> | null;
                  const equip = a.equipements as Record<string, unknown>;
                  const parc = equip?.parcs as Record<string, unknown> | null;
                  const zone = equip?.zones as Record<string, unknown> | null;
                  const criticite = mapCriticite(priorite);
                  const statutInfo = getStatutInfo(a);
                  const declareLe = a.declare_le as string;

                  return (
                    <tr
                      key={a.numero_bt as string}
                      className={`bg-bg-deep rounded-lg border-l-[3px] ${
                        criticite === 'bloquant' ? 'border-l-red' : 'border-l-amber'
                      }`}
                    >
                      <td className="px-3.5 py-3 rounded-l-lg"><CritTag niveau={criticite} /></td>
                      <td className="py-3">
                        <div className="text-[13px] font-medium">
                          {equip?.libelle as string ?? equip?.code as string ?? 'N/A'}
                        </div>
                        <div className="text-[11px] text-dim">
                          {parc?.code as string ?? ''} · {parc?.nom as string ?? ''}{zone ? ` · ${zone.nom as string}` : ''}
                        </div>
                      </td>
                      <td className="py-3 text-[11px] text-dim whitespace-nowrap">depuis {formatDuree(declareLe)}</td>
                      <td className={`py-3 text-[11px] whitespace-nowrap ${statutToneClass[statutInfo.tone]}`}>{statutInfo.texte}</td>
                      <td className="py-3 pr-3.5 rounded-r-lg">
                        <button className="bg-transparent border border-nikito-cyan text-nikito-cyan px-2.5 py-1.5 rounded-md text-[11px]">
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
