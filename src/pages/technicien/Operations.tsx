import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabletHeader } from '@/components/layout/TabletHeader';
import { TicketCard, type TicketSummary } from '@/components/tickets/TicketCard';
import { Pill } from '@/components/ui/Pill';
import { cn, formatDateCourt, formatDuree } from '@/lib/utils';
import { useIncidents } from '@/hooks/queries/useTickets';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import type { Criticite } from '@/types/database';

type Onglet = 'a_faire' | 'en_cours' | 'controles' | 'preventif';

interface ParcOption {
  id: string;
  code: string;
  nom: string;
}

function TicketSkeleton() {
  return (
    <div className="bg-bg-card rounded-xl p-[13px] px-4 flex items-center gap-3 animate-pulse">
      <div className="h-5 w-[54px] bg-white/[0.06] rounded-md" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-48 bg-white/[0.06] rounded" />
        <div className="h-3 w-32 bg-white/[0.06] rounded" />
      </div>
    </div>
  );
}

function mapCriticite(priorite: Record<string, unknown> | null): Criticite {
  const code = (priorite?.code as string) ?? '';
  if (code === 'bloquant') return 'bloquant';
  if (code === 'majeur') return 'majeur';
  return 'mineur';
}

function incidentToTicket(inc: Record<string, unknown>): TicketSummary {
  const equip = inc.equipements as Record<string, unknown> | null;
  const priorite = inc.niveaux_priorite as Record<string, unknown> | null;
  const zone = equip?.zones as Record<string, unknown> | null;
  const parc = equip?.parcs as Record<string, unknown> | null;
  const cat = equip?.categories_equipement as Record<string, unknown> | null;
  const criticite = mapCriticite(priorite);
  const declareLe = inc.declare_le as string;
  const slaH = (priorite?.sla_h as number) ?? 24;
  const heuresDepuis = (Date.now() - new Date(declareLe).getTime()) / 3_600_000;

  const badges: TicketSummary['badges'] = [];
  if (cat?.nom) badges.push({ label: cat.nom as string });
  if (heuresDepuis > slaH) {
    badges.push({ label: `SLA depassé · ${formatDuree(declareLe)}`, tone: 'amber' });
  }

  return {
    numeroBT: inc.numero_bt as string,
    criticite,
    titre: `${equip?.libelle as string ?? ''} · ${inc.description as string}`,
    zone: (zone?.nom as string) ?? undefined,
    description: inc.statut === 'ouvert' && criticite === 'bloquant'
      ? `${equip?.code as string ?? ''} · signalé ${formatDuree(declareLe)}`
      : undefined,
    badges: badges.length > 0 ? badges : undefined,
    slaAlert: heuresDepuis > slaH ? `SLA dépassé · ${formatDuree(declareLe)}` : undefined,
    meta: `${parc?.code as string ?? ''} · ${inc.numero_bt as string} · ${formatDuree(declareLe)}`,
    enAttente: inc.statut === 'assigne',
  };
}

function useParcsVisibles() {
  const { utilisateur } = useAuth();
  const { data: allParcs, isLoading } = useParcs();

  const role = utilisateur?.role_code;
  const parcIds = utilisateur?.parc_ids ?? [];

  const parcsVisibles: ParcOption[] = useMemo(() => {
    if (!allParcs) return [];
    const raw = allParcs as ParcOption[];
    if (role === 'direction' || role === 'chef_maintenance' || role === 'admin_it') return raw;
    return raw.filter((p) => parcIds.includes(p.id));
  }, [allParcs, role, parcIds]);

  const peutVoirTous = role === 'direction' || role === 'chef_maintenance' || role === 'admin_it';

  return { parcsVisibles, peutVoirTous, isLoading };
}

export function Operations() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>('a_faire');
  const [zoneFiltre, setZoneFiltre] = useState<string>('toutes');
  const [parcActif, setParcActif] = useState<string | null>(null);

  const { parcsVisibles, peutVoirTous } = useParcsVisibles();

  const parcIdEffectif = useMemo(() => {
    if (parcActif) return parcActif;
    if (peutVoirTous) return undefined;
    if (parcsVisibles.length === 1) return parcsVisibles[0].id;
    return undefined;
  }, [parcActif, peutVoirTous, parcsVisibles]);

  const parcActuel = useMemo(() => {
    if (!parcIdEffectif) return null;
    return parcsVisibles.find((p) => p.id === parcIdEffectif) ?? null;
  }, [parcIdEffectif, parcsVisibles]);

  const headerParc = parcActuel
    ? { nom: parcActuel.nom, code: parcActuel.code }
    : { nom: 'Tous les parcs', code: 'ALL' };

  const statutsFiltres = onglet === 'en_cours'
    ? ['en_cours' as const]
    : ['ouvert' as const, 'assigne' as const];

  const incidentsQ = useIncidents({
    parcId: parcIdEffectif,
    statuts: statutsFiltres,
  });

  const allIncidentsQ = useIncidents({
    parcId: parcIdEffectif,
  });

  const tickets = useMemo(() => {
    if (!incidentsQ.data) return [];
    return (incidentsQ.data as Record<string, unknown>[]).map(incidentToTicket);
  }, [incidentsQ.data]);

  const zones = useMemo(() => {
    const zoneSet = new Set<string>();
    tickets.forEach((t) => {
      if (t.zone) zoneSet.add(t.zone);
    });
    return ['toutes', ...Array.from(zoneSet).sort()];
  }, [tickets]);

  const ticketsFiltres = tickets.filter((t) => {
    if (zoneFiltre === 'toutes') return true;
    return t.zone === zoneFiltre;
  });

  const compteurs = useMemo(() => {
    if (!allIncidentsQ.data) return { aFaire: 0, enCours: 0 };
    const all = allIncidentsQ.data as Record<string, unknown>[];
    return {
      aFaire: all.filter((i) => i.statut === 'ouvert' || i.statut === 'assigne').length,
      enCours: all.filter((i) => i.statut === 'en_cours').length,
    };
  }, [allIncidentsQ.data]);

  const [premier, ...autres] = ticketsFiltres;

  const initiales = utilisateur
    ? `${utilisateur.prenom.charAt(0)}${utilisateur.nom.charAt(0)}`
    : '??';

  const now = new Date();

  return (
    <>
      <TabletHeader
        parc={headerParc.nom}
        parcCode={headerParc.code}
        titre={`Mes opérations · ${formatDateCourt(now)}`}
        user={utilisateur ? { initiales, prenom: utilisateur.prenom } : undefined}
        enService={!!utilisateur}
      />

      {parcsVisibles.length > 1 && (
        <div className="px-3 md:px-[18px] pt-3 bg-bg-deep flex gap-2 overflow-x-auto pb-1">
          {peutVoirTous && (
            <Pill active={parcActif === null} onClick={() => setParcActif(null)}>
              Tous les parcs
            </Pill>
          )}
          {parcsVisibles.map((p) => (
            <Pill
              key={p.id}
              active={parcActif === p.id}
              onClick={() => setParcActif(p.id)}
            >
              {p.code} · {p.nom}
            </Pill>
          ))}
        </div>
      )}

      <div className="px-3 md:px-[18px] pt-3 bg-bg-deep flex gap-2 overflow-x-auto">
        {[
          { code: 'a_faire' as Onglet, label: 'À faire', badge: compteurs.aFaire, badgeTone: 'white' },
          { code: 'en_cours' as Onglet, label: 'En cours', badge: compteurs.enCours, badgeTone: 'amber' },
          { code: 'controles' as Onglet, label: 'Contrôles' },
          { code: 'preventif' as Onglet, label: 'Préventif' },
        ].map((o) => (
          <button
            key={o.code}
            onClick={() => setOnglet(o.code)}
            className={cn(
              'px-4 py-2.5 rounded-pill text-[13px] whitespace-nowrap min-h-[44px]',
              onglet === o.code
                ? 'bg-gradient-cta text-text font-semibold'
                : 'bg-bg-card border border-white/[0.08] text-dim'
            )}
          >
            {o.label}
            {o.badge != null && o.badge > 0 && (
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

      <div className="px-3 md:px-[18px] py-3 bg-bg-deep flex gap-2 items-center flex-wrap border-b border-white/[0.04]">
        <span className="text-[11px] text-faint uppercase tracking-wider mr-1">Zone</span>
        {zones.map((z) => (
          <button
            key={z}
            onClick={() => setZoneFiltre(z)}
            className={cn(
              'px-3 py-1.5 rounded-[14px] text-[11px] min-h-[44px]',
              zoneFiltre === z
                ? 'bg-nikito-cyan text-bg-app font-semibold'
                : 'bg-transparent border border-white/10 text-dim'
            )}
          >
            {z === 'toutes' ? 'Toutes' : z}
          </button>
        ))}
      </div>

      <div className="p-3 px-3 md:p-3.5 md:px-[18px] flex flex-col gap-2.5 bg-bg-app">
        {incidentsQ.isLoading ? (
          <>
            <TicketSkeleton />
            <TicketSkeleton />
            <TicketSkeleton />
          </>
        ) : onglet === 'controles' || onglet === 'preventif' ? (
          <div className="text-center py-12 text-dim text-sm">
            {onglet === 'controles' ? 'Contrôles à venir' : 'Préventif à venir'}
          </div>
        ) : ticketsFiltres.length === 0 ? (
          <div className="text-center py-12 text-dim text-sm">
            Aucun ticket {onglet === 'en_cours' ? 'en cours' : 'à traiter'}
          </div>
        ) : (
          <>
            {premier && (
              <TicketCard
                ticket={premier}
                variant="expanded"
                onDemarrer={() => navigate(`/tech/operations/${premier.numeroBT}`)}
                onReassigner={() => {}}
              />
            )}
            {autres.map((t) => (
              <TicketCard
                key={t.numeroBT}
                ticket={t}
                variant="compact"
                onClick={() => navigate(`/tech/operations/${t.numeroBT}`)}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
