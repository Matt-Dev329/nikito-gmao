import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Cell, PieChart, Pie, Cell as PieCell, Tooltip } from 'recharts';
import { KpiCard } from '@/components/kpi/KpiCard';
import { Pill } from '@/components/ui/Pill';
import { Card, CardHead } from '@/components/ui/Card';
import { CritTag } from '@/components/ui/CritTag';
import { Logo } from '@/components/ui/Logo';
import { formatDateLong, formatHeure } from '@/lib/utils';
import { kpiLabels } from '@/lib/tokens';

type Periode = '7j' | '30j' | '90j';

// TODO · remplacer par useQuery sur les vues SQL vue_kpi_*
const kpiMock = {
  performance: { valeur: '94,2', delta: { texte: '▲ 2,1 pts vs sem. dernière', tone: 'positif' as const } },
  mtbf: { valeur: '11,4', delta: { texte: 'MTBF · moy. 30j', tone: 'neutre' as const } },
  mttr: { valeur: '42', delta: { texte: '▼ 6 min vs sem. dernière', tone: 'positif' as const } },
  premierCoup: { valeur: '87', delta: { texte: 'cible 90% · 30j', tone: 'neutre' as const } },
  plaintes: { valeur: '7', delta: { texte: '▲ 3 vs 7 derniers j', tone: 'negatif' as const } },
};

const perfData = [
  { parc: 'FRA', perf: 96.4 },
  { parc: 'SGB', perf: 94.8 },
  { parc: 'DOM', perf: 89.7 },
  { parc: 'ALF', perf: 95.9 },
];

const critData = [
  { name: 'Bloquant', value: 3, color: '#FF4D6D' },
  { name: 'Majeur', value: 12, color: '#FFB547' },
  { name: 'Mineur', value: 23, color: '#5DE5FF' },
];

interface AlerteEnCours {
  numeroBT: string;
  criticite: 'bloquant' | 'majeur';
  titre: string;
  contexte: string;
  duree: string;
  statut: { texte: string; tone: 'amber' | 'pink' | 'dim' };
}

// Alertes initiales = anomalies Rosny du README (cf section Notes importantes)
const alertesMock: AlerteEnCours[] = [
  {
    numeroBT: 'BT-2026-0412',
    criticite: 'bloquant',
    titre: 'Submarine · panne offline',
    contexte: 'DOM · Rosny Domus · zone Attractions',
    duree: 'depuis 2j 4h',
    statut: { texte: 'SLA dépassé · escalade', tone: 'amber' },
  },
  {
    numeroBT: 'BT-2026-0418',
    criticite: 'majeur',
    titre: 'Tilt · badgeuse HS',
    contexte: 'DOM · 3ème occurrence en 30j',
    duree: 'depuis 6h',
    statut: { texte: '5 Pourquoi requis', tone: 'pink' },
  },
  {
    numeroBT: 'BT-2026-0419',
    criticite: 'majeur',
    titre: 'Roof Top · badgeuse HS',
    contexte: 'DOM · Rosny Domus',
    duree: 'depuis 6h',
    statut: { texte: 'assigné MS', tone: 'dim' },
  },
  {
    numeroBT: 'BT-2026-0415',
    criticite: 'majeur',
    titre: 'Basket · porte HS',
    contexte: 'DOM · Rosny Domus',
    duree: 'depuis 1j',
    statut: { texte: 'en attente pièce', tone: 'dim' },
  },
];

const statutToneClass = {
  amber: 'text-amber',
  pink: 'text-nikito-pink',
  dim: 'text-dim',
};

export function TableauDeBord() {
  const [periode, setPeriode] = useState<Periode>('30j');
  const [parcActif, setParcActif] = useState<string | null>(null);

  const now = new Date();

  return (
    <div className="p-6 px-7 overflow-hidden">
      <div className="flex justify-between items-start mb-[18px]">
        <div>
          <div className="text-[11px] text-dim tracking-[1.5px] uppercase mb-1">
            {formatDateLong(now)} · {formatHeure(now)}
          </div>
          <h1 className="text-[22px] font-semibold m-0">Pilotage temps réel</h1>
        </div>
        <div className="flex gap-2">
          {(['7j', '30j', '90j'] as Periode[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={
                periode === p
                  ? 'bg-gradient-cta text-text px-3.5 py-1.5 rounded-lg text-xs font-medium'
                  : 'bg-bg-card border border-white/[0.08] text-text px-3.5 py-1.5 rounded-lg text-xs'
              }
            >
              {p === '7j' ? '7 jours' : p === '30j' ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <Pill active={parcActif === null} onClick={() => setParcActif(null)}>
          Tous les parcs
        </Pill>
        {[
          { code: 'FRA', nom: 'Franconville' },
          { code: 'SGB', nom: 'Ste-Geneviève' },
          { code: 'DOM', nom: 'Rosny Domus' },
          { code: 'ALF', nom: 'Alfortville' },
        ].map((p) => (
          <Pill key={p.code} active={parcActif === p.code} onClick={() => setParcActif(p.code)}>
            {p.code} · {p.nom}
          </Pill>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard label={kpiLabels.performance} valeur={kpiMock.performance.valeur} unite="%" delta={kpiMock.performance.delta} couleur="lime" />
        <KpiCard label={kpiLabels.mtbf} valeur={kpiMock.mtbf.valeur} unite=" j" delta={kpiMock.mtbf.delta} couleur="cyan" />
        <KpiCard label={kpiLabels.mttr} valeur={kpiMock.mttr.valeur} unite=" min" delta={kpiMock.mttr.delta} couleur="violet" />
        <KpiCard label={kpiLabels.premierCoup} valeur={kpiMock.premierCoup.valeur} unite="%" delta={kpiMock.premierCoup.delta} couleur="green" />
        <KpiCard label={kpiLabels.plaintes} valeur={kpiMock.plaintes.valeur} delta={kpiMock.plaintes.delta} couleur="amber" />
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-3.5 mb-[18px]">
        <Card>
          <CardHead titre="Performance par parc · 30 derniers jours" meta="% disponibilité bloquants" />
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="parc" axisLine={false} tickLine={false} tick={{ fill: '#A8A8C8', fontSize: 11 }} />
                <YAxis domain={[80, 100]} axisLine={false} tickLine={false} tick={{ fill: '#A8A8C8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <ReferenceLine y={95} stroke="#5DE5FF" strokeDasharray="6 4" />
                <Bar dataKey="perf" radius={[6, 6, 0, 0]}>
                  {perfData.map((d) => (
                    <Cell key={d.parc} fill={d.perf >= 95 ? '#D4F542' : '#FFB547'} />
                  ))}
                </Bar>
                <Tooltip contentStyle={{ background: '#0D0D38', border: '1px solid #2A2A5A', borderRadius: 8, color: '#fff', fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHead titre="Tickets par criticité · 7j" meta="38 au total" />
          <div className="h-[200px] flex items-center gap-4">
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
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                  <span className="text-dim">{d.name}</span>
                  <span className="font-medium ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead titre="Alertes en cours · à arbitrer" meta={`${alertesMock.length} actives`} metaTone="red" />
        <div className="flex flex-col gap-2">
          {alertesMock.map((a) => (
            <div
              key={a.numeroBT}
              className={
                a.criticite === 'bloquant'
                  ? 'grid grid-cols-[90px_1fr_120px_140px_100px] gap-3 items-center px-3.5 py-3 bg-bg-deep rounded-lg border-l-[3px] border-l-red'
                  : 'grid grid-cols-[90px_1fr_120px_140px_100px] gap-3 items-center px-3.5 py-3 bg-bg-deep rounded-lg border-l-[3px] border-l-amber'
              }
            >
              <CritTag niveau={a.criticite} />
              <div>
                <div className="text-[13px] font-medium">{a.titre}</div>
                <div className="text-[11px] text-dim">{a.contexte}</div>
              </div>
              <span className="text-[11px] text-dim">{a.duree}</span>
              <span className={`text-[11px] ${statutToneClass[a.statut.tone]}`}>{a.statut.texte}</span>
              <button className="bg-transparent border border-nikito-cyan text-nikito-cyan px-2.5 py-1.5 rounded-md text-[11px]">
                Ouvrir
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
