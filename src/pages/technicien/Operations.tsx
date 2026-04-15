import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabletHeader } from '@/components/layout/TabletHeader';
import { TicketCard, type TicketSummary } from '@/components/tickets/TicketCard';
import { cn } from '@/lib/utils';

type Onglet = 'a_faire' | 'en_cours' | 'controles' | 'preventif';
type ZoneFiltre = 'toutes' | 'attractions' | 'arcade' | 'karting' | 'bowling';

// TODO · alimenter via useQuery sur la table incidents avec join equipements
const ticketsMock: TicketSummary[] = [
  {
    numeroBT: 'BT-2026-0412',
    criticite: 'bloquant',
    titre: 'Submarine · panne offline',
    zone: 'Attractions',
    description:
      'DOM-ATR-SUB-01 · le système ne répond pas au boot. Signalé hier matin par le staff ouverture.',
    badges: [
      { label: '📍 Plan' },
      { label: '📷 2 photos' },
      { label: '📋 Historique 3 pannes/30j' },
    ],
    slaAlert: 'SLA dépassé · 2j 4h',
  },
  {
    numeroBT: 'BT-2026-0418',
    criticite: 'majeur',
    titre: 'Tilt · badgeuse HS',
    zone: 'Arcade',
    badges: [{ label: '3e en 30j', tone: 'pink' }],
    meta: 'Arcade · BT-2026-0418 · 6h',
  },
  {
    numeroBT: 'BT-2026-0419',
    criticite: 'majeur',
    titre: 'Roof Top · badgeuse HS',
    zone: 'Arcade',
    meta: 'Arcade · BT-2026-0419 · 6h',
  },
  {
    numeroBT: 'BT-2026-0415',
    criticite: 'majeur',
    titre: 'Basket · porte HS',
    zone: 'Arcade',
    badges: [{ label: '⏸ pièce' }],
    meta: 'Arcade · BT-2026-0415 · livraison vendredi',
    enAttente: true,
  },
  {
    numeroBT: 'BT-2026-0421',
    criticite: 'mineur',
    titre: 'Karting · pack 7 · phare AV cassé',
    zone: 'Karting',
    meta: 'Karting · BT-2026-0421 · 35 min estimé',
  },
];

const zones: { code: ZoneFiltre; label: string }[] = [
  { code: 'toutes', label: 'Toutes' },
  { code: 'attractions', label: 'Attractions' },
  { code: 'arcade', label: 'Arcade' },
  { code: 'karting', label: 'Karting' },
  { code: 'bowling', label: 'Bowling' },
];

export function Operations() {
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState<Onglet>('a_faire');
  const [zoneFiltre, setZoneFiltre] = useState<ZoneFiltre>('toutes');

  const ticketsFiltres = ticketsMock.filter((t) => {
    if (zoneFiltre === 'toutes') return true;
    return t.zone?.toLowerCase() === zoneFiltre;
  });

  const [premier, ...autres] = ticketsFiltres;

  return (
    <>
      <TabletHeader
        parc="Rosny Domus"
        parcCode="DOM"
        titre="Mes opérations · mer. 15 avril"
        user={{ initiales: 'MS', prenom: 'Mamady' }}
        enService
      />

      <div className="px-[18px] pt-3 bg-bg-deep flex gap-2 overflow-x-auto">
        {[
          { code: 'a_faire' as Onglet, label: 'À faire', badge: 5, badgeTone: 'white' },
          { code: 'en_cours' as Onglet, label: 'En cours', badge: 1, badgeTone: 'amber' },
          { code: 'controles' as Onglet, label: 'Contrôles' },
          { code: 'preventif' as Onglet, label: 'Préventif' },
        ].map((o) => (
          <button
            key={o.code}
            onClick={() => setOnglet(o.code)}
            className={cn(
              'px-4 py-2.5 rounded-pill text-[13px] whitespace-nowrap',
              onglet === o.code
                ? 'bg-gradient-cta text-text font-semibold'
                : 'bg-bg-card border border-white/[0.08] text-dim'
            )}
          >
            {o.label}
            {o.badge && (
              <span
                className={cn(
                  'ml-1.5 px-2 py-0.5 rounded-lg text-[11px]',
                  onglet === o.code
                    ? 'bg-white/25'
                    : o.badgeTone === 'amber'
                    ? 'bg-amber text-bg-app font-semibold'
                    : 'bg-white/25'
                )}
              >
                {o.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-[18px] py-3 bg-bg-deep flex gap-2 items-center flex-wrap border-b border-white/[0.04]">
        <span className="text-[11px] text-faint uppercase tracking-wider mr-1">Zone</span>
        {zones.map((z) => (
          <button
            key={z.code}
            onClick={() => setZoneFiltre(z.code)}
            className={cn(
              'px-3 py-1.5 rounded-[14px] text-[11px]',
              zoneFiltre === z.code
                ? 'bg-nikito-cyan text-bg-app font-semibold'
                : 'bg-transparent border border-white/10 text-dim'
            )}
          >
            {z.label}
          </button>
        ))}
      </div>

      <div className="p-3.5 px-[18px] flex flex-col gap-2.5 bg-bg-app">
        {/* Plan SVG */}
        <div className="bg-bg-deep rounded-xl p-2.5 px-3.5">
          <div className="text-[10px] text-faint uppercase tracking-wider mb-2">
            Plan du parc · touchez un point
          </div>
          <PlanRosny />
        </div>

        {premier && (
          <TicketCard
            ticket={premier}
            variant="expanded"
            onDemarrer={() => navigate(`/operations/${premier.numeroBT}`)}
            onReassigner={() => alert('Réassigner à venir')}
          />
        )}

        {autres.map((t) => (
          <TicketCard
            key={t.numeroBT}
            ticket={t}
            variant="compact"
            onClick={() => navigate(`/operations/${t.numeroBT}`)}
          />
        ))}
      </div>
    </>
  );
}

function PlanRosny() {
  // TODO · récupérer dynamiquement les zones et incidents en cours
  // Coordonnées zones depuis zones.coordonnees_plan (JSONB)
  return (
    <svg viewBox="0 0 760 180" className="w-full block">
      <rect x="2" y="2" width="756" height="176" rx="8" fill="#0B0B2E" stroke="rgba(255,255,255,.08)" />
      <rect x="20" y="20" width="200" height="140" rx="6" fill="#151547" stroke="rgba(93,229,255,.2)" />
      <text x="120" y="95" textAnchor="middle" fill="#A8A8C8" fontSize="11">Attractions</text>
      <rect x="240" y="20" width="280" height="80" rx="6" fill="#151547" stroke="rgba(93,229,255,.2)" />
      <text x="380" y="65" textAnchor="middle" fill="#A8A8C8" fontSize="11">Arcade</text>
      <rect x="240" y="115" width="280" height="45" rx="6" fill="#151547" stroke="rgba(93,229,255,.2)" />
      <text x="380" y="142" textAnchor="middle" fill="#A8A8C8" fontSize="11">Bowling</text>
      <rect x="540" y="20" width="200" height="140" rx="6" fill="#151547" stroke="rgba(93,229,255,.2)" />
      <text x="640" y="95" textAnchor="middle" fill="#A8A8C8" fontSize="11">Karting</text>
      {[
        { x: 80, y: 60, color: '#FF4D6D' },
        { x: 290, y: 50, color: '#FFB547' },
        { x: 345, y: 75, color: '#FFB547' },
        { x: 450, y: 60, color: '#FFB547' },
        { x: 640, y: 80, color: '#5DE5FF' },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="11" fill={p.color} stroke="#0B0B2E" strokeWidth="2" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#0B0B2E" fontSize="11" fontWeight="700">
            1
          </text>
        </g>
      ))}
    </svg>
  );
}
