import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabletHeader } from '@/components/layout/TabletHeader';
import { TicketCard, type TicketSummary } from '@/components/tickets/TicketCard';
import { ModaleReassignerTicket } from '@/components/tickets/ModaleReassignerTicket';
import { Pill } from '@/components/ui/Pill';
import { cn, formatDateCourt, formatDuree } from '@/lib/utils';
import { useIncidents, useReprendreIncident } from '@/hooks/queries/useTickets';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useToast } from '@/components/ui/ToastProvider';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import type { Criticite } from '@/types/database';

type Onglet = 'a_faire' | 'en_cours' | 'attente_piece' | 'exterieur' | 'resolus' | 'controles' | 'preventif';

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
  if (inc.statut === 'en_pause') badges.push({ label: 'En pause', tone: 'amber' });
  if (inc.attente_piece === true) {
    badges.push({ label: `Pièce en attente${inc.attente_piece_detail ? ` · ${inc.attente_piece_detail as string}` : ''}`, tone: 'amber' });
  }
  if (inc.externe === true) {
    const f = inc.externe_fournisseur as { nom: string } | null;
    const prevu = inc.externe_date_prevue
      ? ` · prévu le ${new Date(`${inc.externe_date_prevue as string}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`
      : '';
    badges.push({ label: `Extérieur · ${f?.nom ?? (inc.externe_nom as string) ?? 'intervenant'}${prevu}`, tone: 'amber' });
  }
  if (heuresDepuis > slaH) {
    badges.push({ label: `SLA depassé · ${formatDuree(declareLe)}`, tone: 'amber' });
  }

  return {
    id: inc.id as string,
    numeroBT: inc.numero_bt as string,
    criticite,
    // Titre : activité · pièce en panne
    titre: [cat?.activite as string | undefined, (equip?.libelle as string | undefined) ?? (inc.titre as string | undefined)]
      .filter(Boolean)
      .join(' · '),
    zone: (zone?.nom as string) ?? undefined,
    activite: (cat?.activite as string) ?? 'Autres',
    description: inc.statut === 'ouvert' && criticite === 'bloquant'
      ? `${equip?.code as string ?? ''} · signalé ${formatDuree(declareLe)}`
      : undefined,
    badges: badges.length > 0 ? badges : undefined,
    slaAlert: heuresDepuis > slaH ? `SLA dépassé · ${formatDuree(declareLe)}` : undefined,
    meta: `${parc?.code as string ?? ''} · ${inc.numero_bt as string} · ${formatDuree(declareLe)}`,
    enAttente: inc.statut === 'assigne',
    enPause: inc.statut === 'en_pause',
    photoPath: ((inc.photos_urls as string[] | null) ?? [])[0] ?? undefined,
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
    if (role === 'direction' || role === 'chef_maintenance' || role === 'directeur_parc' || role === 'admin_it') return raw;
    return raw.filter((p) => parcIds.includes(p.id));
  }, [allParcs, role, parcIds]);

  const peutVoirTous = role === 'direction' || role === 'chef_maintenance' || role === 'directeur_parc' || role === 'admin_it';

  return { parcsVisibles, peutVoirTous, isLoading };
}

export function Operations() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const toast = useToast();
  const reprendre = useReprendreIncident();
  const [onglet, setOnglet] = useState<Onglet>('a_faire');
  const [zoneFiltre, setZoneFiltre] = useState<string>('toutes');
  const [activiteFiltre, setActiviteFiltre] = useState<string>('toutes');
  const [parcActif, setParcActif] = useState<string | null>(null);
  const [reassignerCible, setReassignerCible] = useState<{ id: string; numeroBT: string } | null>(null);

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
    : onglet === 'resolus'
    ? ['resolu' as const, 'ferme' as const]
    : onglet === 'exterieur' || onglet === 'attente_piece'
    ? ['ouvert' as const, 'assigne' as const, 'en_pause' as const, 'en_cours' as const]
    : ['ouvert' as const, 'assigne' as const, 'en_pause' as const];

  const incidentsQ = useIncidents({
    parcId: parcIdEffectif,
    statuts: statutsFiltres,
  });

  const allIncidentsQ = useIncidents({
    parcId: parcIdEffectif,
  });

  const tickets = useMemo(() => {
    if (!incidentsQ.data) return [];
    // Tickets confiés à un intervenant extérieur : seulement dans l'onglet « Extérieur »
    return (incidentsQ.data as Record<string, unknown>[])
      .filter((i) =>
        onglet === 'resolus'
          ? true
          : onglet === 'exterieur'
          ? i.externe === true
          : onglet === 'attente_piece'
          ? i.attente_piece === true
          : i.externe !== true && i.attente_piece !== true
      )
      .map(incidentToTicket);
  }, [incidentsQ.data, onglet]);

  // Activités présentes dans l'onglet, avec leur nombre de tickets (« Autres » en dernier)
  const activites = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach((t) => m.set(t.activite ?? 'Autres', (m.get(t.activite ?? 'Autres') ?? 0) + 1));
    return [...m.entries()].sort((a, b) =>
      a[0] === 'Autres' ? 1 : b[0] === 'Autres' ? -1 : a[0].localeCompare(b[0], 'fr')
    );
  }, [tickets]);
  const activiteActive = activites.some(([a]) => a === activiteFiltre) ? activiteFiltre : 'toutes';

  const ticketsActivite = tickets.filter((t) => activiteActive === 'toutes' || t.activite === activiteActive);

  const zones = useMemo(() => {
    const zoneSet = new Set<string>();
    ticketsActivite.forEach((t) => {
      if (t.zone) zoneSet.add(t.zone);
    });
    return ['toutes', ...Array.from(zoneSet).sort()];
  }, [ticketsActivite]);

  const ticketsZone = ticketsActivite.filter((t) => {
    if (zoneFiltre === 'toutes') return true;
    return t.zone === zoneFiltre;
  });

  // Vignette de la photo du problème (URLs signées en un seul appel)
  const { data: urlsPhotos } = useSignedUrls(
    ticketsZone.map((t) => t.photoPath),
    'alba-incidents'
  );
  const ticketsFiltres = ticketsZone.map((t) => (t.photoPath && urlsPhotos?.[t.photoPath] ? { ...t, photoUrl: urlsPhotos[t.photoPath] } : t));

  const compteurs = useMemo(() => {
    if (!allIncidentsQ.data) return { aFaire: 0, enCours: 0, attentePiece: 0, exterieur: 0, resolus: 0 };
    const all = allIncidentsQ.data as Record<string, unknown>[];
    const ouverts = (i: Record<string, unknown>) =>
      i.statut === 'ouvert' || i.statut === 'assigne' || i.statut === 'en_pause' || i.statut === 'en_cours';
    return {
      aFaire: all.filter(
        (i) => i.externe !== true && i.attente_piece !== true && (i.statut === 'ouvert' || i.statut === 'assigne' || i.statut === 'en_pause')
      ).length,
      enCours: all.filter((i) => i.externe !== true && i.attente_piece !== true && i.statut === 'en_cours').length,
      attentePiece: all.filter((i) => i.attente_piece === true && ouverts(i)).length,
      exterieur: all.filter((i) => i.externe === true && ouverts(i)).length,
      resolus: all.filter((i) => i.statut === 'resolu' || i.statut === 'ferme').length,
    };
  }, [allIncidentsQ.data]);

  const reprendreTicket = (id: string) => {
    reprendre.mutate(id, {
      onSuccess: () => toast.success('Intervention reprise'),
      onError: () => toast.error('Impossible de reprendre le ticket'),
    });
  };

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
          { code: 'attente_piece' as Onglet, label: 'Pièce en attente', badge: compteurs.attentePiece, badgeTone: 'amber' },
          { code: 'exterieur' as Onglet, label: 'Extérieur', badge: compteurs.exterieur, badgeTone: 'amber' },
          { code: 'resolus' as Onglet, label: 'Résolus', badge: compteurs.resolus, badgeTone: 'white' },
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

      {activites.length > 0 && (
        <div className="px-3 md:px-[18px] pt-3 bg-bg-deep flex gap-2 items-center overflow-x-auto">
          <span className="text-[11px] text-faint uppercase tracking-wider mr-1 flex-shrink-0">Activité</span>
          {[['toutes', tickets.length] as [string, number], ...activites].map(([a, n]) => (
            <button
              key={a}
              onClick={() => {
                setActiviteFiltre(a);
                setZoneFiltre('toutes');
              }}
              className={cn(
                'px-3 py-1.5 rounded-[14px] text-[12px] min-h-[40px] whitespace-nowrap flex-shrink-0',
                activiteActive === a
                  ? 'bg-gradient-cta text-text font-semibold'
                  : 'bg-bg-card border border-white/[0.08] text-dim'
              )}
            >
              {a === 'toutes' ? 'Toutes' : a}
              <span className="ml-1.5 opacity-70">{n}</span>
            </button>
          ))}
        </div>
      )}

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
            Aucun ticket {onglet === 'en_cours' ? 'en cours' : onglet === 'resolus' ? 'résolu' : onglet === 'exterieur' ? 'confié à un intervenant extérieur' : onglet === 'attente_piece' ? 'en attente de pièce' : 'à traiter'}
          </div>
        ) : onglet === 'resolus' || onglet === 'exterieur' || onglet === 'attente_piece' ? (
          <>
            {ticketsFiltres.map((t) => (
              <TicketCard
                key={t.numeroBT}
                ticket={t}
                variant="compact"
                onClick={() => navigate(`/tech/operations/${t.numeroBT}`)}
              />
            ))}
          </>
        ) : (
          <>
            {premier && (
              <TicketCard
                ticket={premier}
                variant="expanded"
                onDemarrer={() => navigate(`/tech/operations/${premier.numeroBT}`)}
                onReassigner={() => setReassignerCible({ id: premier.id, numeroBT: premier.numeroBT })}
                onReprendre={() => reprendreTicket(premier.id)}
                reprenant={reprendre.isPending}
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

      {reassignerCible && (
        <ModaleReassignerTicket
          incidentId={reassignerCible.id}
          numeroBT={reassignerCible.numeroBT}
          onClose={() => setReassignerCible(null)}
        />
      )}
    </>
  );
}
