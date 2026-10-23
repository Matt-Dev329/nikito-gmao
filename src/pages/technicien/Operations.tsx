import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabletHeader } from '@/components/layout/TabletHeader';
import { TicketCard, type TicketSummary } from '@/components/tickets/TicketCard';
import { ModaleReassignerTicket } from '@/components/tickets/ModaleReassignerTicket';
import { Pill } from '@/components/ui/Pill';
import { cn, estCheminVideo, formatDateCourt, formatDuree } from '@/lib/utils';
import { useIncidents, useNombreTicketsParParc, useReprendreIncident, useTicketsAValider, useValiderTicket } from '@/hooks/queries/useTickets';
import { ModaleSupprimerTicket } from '@/components/tickets/ModaleSupprimerTicket';
import { ModaleClotureRapide } from '@/components/tickets/ModaleClotureRapide';
import { peutValiderTicket } from '@/lib/acces';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useToast } from '@/components/ui/ToastProvider';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import type { Criticite } from '@/types/database';

type Onglet = 'a_valider' | 'a_faire' | 'en_cours' | 'attente_piece' | 'exterieur' | 'resolus' | 'controles' | 'preventif';

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
  // En retard : ticket encore ouvert au-delà du délai de sa gravité
  const ouvert = !['resolu', 'ferme', 'annule'].includes(inc.statut as string);
  const enRetard = ouvert && heuresDepuis > slaH;

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
  if (enRetard) {
    badges.push({ label: `En retard · ${formatDuree(declareLe)}`, tone: 'red' });
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
    slaAlert: enRetard ? `En retard · ouvert depuis ${formatDuree(declareLe)}` : undefined,
    enRetard,
    declareLe,
    meta: [(parc?.code ?? inc.parc_ticket_code) as string | undefined, inc.numero_bt as string, ouvert ? `depuis ${formatDuree(declareLe)}` : formatDuree(declareLe), inc.declare_par_nom ? `par ${inc.declare_par_nom as string}` : null]
      .filter(Boolean)
      .join(' · '),
    enAttente: inc.statut === 'assigne',
    enPause: inc.statut === 'en_pause',
    photoPath: ((inc.photos_urls as string[] | null) ?? [])[0] ?? undefined,
    photoVideo: estCheminVideo(((inc.photos_urls as string[] | null) ?? [])[0]),
    parcId: ((equip?.parc_id ?? inc.parc_ticket) as string | undefined) ?? undefined,
    probleme: ((inc.description as string | null) ?? '').trim() || undefined,
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
  // Seulement les tickets en retard, du plus ancien au plus récent
  const [retardSeul, setRetardSeul] = useState(false);
  const [parcActif, setParcActif] = useState<string | null>(null);
  const [reassignerCible, setReassignerCible] = useState<{ id: string; numeroBT: string } | null>(null);
  const [suppressionCible, setSuppressionCible] = useState<{ id: string; numeroBT: string } | null>(null);
  const [clotureCible, setClotureCible] = useState<{ id: string; numeroBT: string } | null>(null);
  const validerTicket = useValiderTicket();
  // Managers de parc : suivi des tickets en lecture seule (ni démarrage, ni réassignation)
  // Directeurs et managers : suivi des tickets sans action d'intervention
  // (sauf autorisation « peut intervenir » sur leurs parcs)
  const lectureSeule =
    (utilisateur?.role_code === 'manager_parc' || utilisateur?.role_code === 'directeur_parc') && !utilisateur?.peut_intervenir;

  // Problème signalé affiché sur les cartes : uniquement pour les directeurs de parc
  const sansProblemeSiNonDirecteur = (t: TicketSummary): TicketSummary =>
    utilisateur?.role_code === 'directeur_parc' ? t : { ...t, probleme: undefined };

  // Valideurs (et suppression) : chef d'équipe, direction, admin IT, directeurs de parc
  const estValideur = ['direction', 'chef_maintenance', 'admin_it', 'directeur_parc'].includes(utilisateur?.role_code ?? '');

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

  // Tickets ouverts : total et nombre par parc (affichés sur les boutons de parc)
  const { data: nombreTickets } = useNombreTicketsParParc();

  // Tickets à valider (staff, managers non principaux) des parcs que l'utilisateur peut valider
  const aValiderQ = useTicketsAValider(estValideur);
  const brutsAValider = useMemo(
    () => new Map(((aValiderQ.data ?? []) as Record<string, unknown>[]).map((i) => [i.id as string, i])),
    [aValiderQ.data]
  );
  const ticketsAValider = useMemo(
    () =>
      ((aValiderQ.data ?? []) as Record<string, unknown>[])
        .filter((i) => {
          const parcId = (i.equipements as { parc_id?: string } | null)?.parc_id ?? (i.parc_ticket as string | undefined);
          return (!parcIdEffectif || parcId === parcIdEffectif) && peutValiderTicket(utilisateur, parcId);
        })
        .map(incidentToTicket)
        .map(sansProblemeSiNonDirecteur),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aValiderQ.data, parcIdEffectif, utilisateur]
  );

  const valider = (t: TicketSummary) =>
    validerTicket.mutate(t.id, {
      onSuccess: () => toast.success(`Ticket ${t.numeroBT} validé : il est dans Opérations`),
      onError: (e) => toast.error((e as Error).message),
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
      .map(incidentToTicket)
      .map(sansProblemeSiNonDirecteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentsQ.data, onglet, utilisateur?.role_code]);

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

  const nbEnRetard = ticketsActivite.filter((t) => t.enRetard).length;
  const ticketsZone = ticketsActivite
    .filter((t) => zoneFiltre === 'toutes' || t.zone === zoneFiltre)
    .filter((t) => !retardSeul || t.enRetard)
    .sort((a, b) => (retardSeul ? (a.declareLe ?? '').localeCompare(b.declareLe ?? '') : 0));

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
  // Suppression (avec motif) : directeurs et managers principaux de leur parc
  // Clôture rapide (justification obligatoire) : chef d'équipe, direction, admin IT, directeurs sur leurs parcs
  const cloturerSiAutorise = (t: TicketSummary) =>
    ['chef_maintenance', 'direction', 'admin_it'].includes(utilisateur?.role_code ?? '') ||
    (utilisateur?.role_code === 'directeur_parc' && !!t.parcId && utilisateur.parc_ids.includes(t.parcId))
      ? () => setClotureCible({ id: t.id, numeroBT: t.numeroBT })
      : undefined;

  const supprimerSiAutorise = (t: TicketSummary) =>
    peutValiderTicket(utilisateur, t.parcId) ? () => setSuppressionCible({ id: t.id, numeroBT: t.numeroBT }) : undefined;

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
              Tous les parcs{nombreTickets && <span className="opacity-70"> · {nombreTickets.total}</span>}
            </Pill>
          )}
          {parcsVisibles.map((p) => (
            <Pill
              key={p.id}
              active={parcActif === p.id}
              onClick={() => setParcActif(p.id)}
            >
              {p.code} · {p.nom}
              {nombreTickets && <span className="opacity-70"> · {nombreTickets.parParc.get(p.id) ?? 0}</span>}
            </Pill>
          ))}
        </div>
      )}

      <div className="px-3 md:px-[18px] pt-3 bg-bg-deep flex gap-2 overflow-x-auto">
        {[
          ...(estValideur
            ? [{ code: 'a_valider' as Onglet, label: 'À valider', badge: ticketsAValider.length, badgeTone: 'amber' }]
            : []),
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
        {(nbEnRetard > 0 || retardSeul) && (
          <button
            onClick={() => setRetardSeul((v) => !v)}
            className={cn(
              'px-3 py-1.5 rounded-[14px] text-[12px] min-h-[40px] whitespace-nowrap font-semibold',
              retardSeul ? 'bg-red text-bg-app' : 'bg-red/10 border border-red/40 text-red'
            )}
          >
            ⏱ En retard <span className="opacity-80">{nbEnRetard}</span>
          </button>
        )}
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
        ) : onglet === 'a_valider' ? (
          ticketsAValider.length === 0 ? (
            <div className="text-center py-12 text-dim text-sm">Aucun ticket à valider</div>
          ) : (
            ticketsAValider.map((t) => (
              <div key={t.numeroBT} className="flex flex-col gap-1.5">
                <TicketCard ticket={t} variant="compact" onClick={() => navigate(`/tech/operations/${t.numeroBT}`)} />
                <DetailAValider incident={brutsAValider.get(t.id)} />
                <div className="flex flex-wrap gap-2 justify-end">
                  {cloturerSiAutorise(t) && (
                    <button
                      onClick={cloturerSiAutorise(t)}
                      className="px-4 rounded-[10px] text-[12px] font-semibold min-h-[40px] bg-bg-card border border-green/40 text-green"
                    >
                      ✓ Clôturer (rien à faire)
                    </button>
                  )}
                  <button
                    onClick={() => setSuppressionCible({ id: t.id, numeroBT: t.numeroBT })}
                    className="px-4 rounded-[10px] text-[12px] font-semibold min-h-[40px] bg-bg-card border border-red/40 text-red"
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={() => valider(t)}
                    disabled={validerTicket.isPending}
                    className="px-4 rounded-[10px] text-[12px] font-bold min-h-[40px] bg-gradient-cta text-text disabled:opacity-50"
                  >
                    ✓ Valider
                  </button>
                </div>
              </div>
            ))
          )
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
                onSupprimer={supprimerSiAutorise(t)}
                onCloturer={onglet === 'resolus' ? undefined : cloturerSiAutorise(t)}
              />
            ))}
          </>
        ) : (
          <>
            {premier && (
              <TicketCard
                ticket={premier}
                variant="expanded"
                onDemarrer={lectureSeule ? undefined : () => navigate(`/tech/operations/${premier.numeroBT}`)}
                onClick={() => navigate(`/tech/operations/${premier.numeroBT}`)}
                onReassigner={lectureSeule ? undefined : () => setReassignerCible({ id: premier.id, numeroBT: premier.numeroBT })}
                onReprendre={lectureSeule ? undefined : () => reprendreTicket(premier.id)}
                reprenant={reprendre.isPending}
                onSupprimer={supprimerSiAutorise(premier)}
                onCloturer={cloturerSiAutorise(premier)}
              />
            )}
            {autres.map((t) => (
              <TicketCard
                key={t.numeroBT}
                ticket={t}
                variant="compact"
                onClick={() => navigate(`/tech/operations/${t.numeroBT}`)}
                onSupprimer={supprimerSiAutorise(t)}
                onCloturer={cloturerSiAutorise(t)}
              />
            ))}
          </>
        )}
      </div>

      {clotureCible && (
        <ModaleClotureRapide incidentId={clotureCible.id} numeroBT={clotureCible.numeroBT} onClose={() => setClotureCible(null)} />
      )}

      {suppressionCible && (
        <ModaleSupprimerTicket
          incidentId={suppressionCible.id}
          numeroBT={suppressionCible.numeroBT}
          onClose={() => setSuppressionCible(null)}
        />
      )}

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

/** Détail d'un ticket à valider : ce qui a été signalé, par qui, avec les photos. */
function DetailAValider({ incident: i }: { incident: Record<string, unknown> | undefined }) {
  const photos = ((i?.photos_urls as string[] | null) ?? []).filter((p) => !estCheminVideo(p));
  const { data: urls } = useSignedUrls(photos, 'alba-incidents');
  if (!i) return null;
  const equip = i.equipements as { code?: string; libelle?: string } | null;
  const equipement = equip ? [equip.code, equip.libelle].filter(Boolean).join(' · ') : null;
  return (
    <div className="bg-bg-card/60 border border-white/[0.06] rounded-xl p-3 text-[13px] grid gap-1.5">
      {i.description ? (
        <div className="whitespace-pre-line">{i.description as string}</div>
      ) : (
        <div className="text-faint">Pas de description</div>
      )}
      <div className="text-[12px] text-dim">
        {[
          equipement ? `Équipement : ${equipement}` : 'Équipement saisi à la main (non rattaché)',
          i.declare_par_nom ? `Signalé par ${i.declare_par_nom as string}` : null,
          i.declare_le ? `le ${formatDateCourt(i.declare_le as string)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </div>
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pt-1">
          {photos.map((p) =>
            urls?.[p] ? (
              <a key={p} href={urls[p]} target="_blank" rel="noreferrer" className="flex-shrink-0">
                <img src={urls[p]} alt="Photo du signalement" loading="lazy" className="w-20 h-20 object-cover rounded-lg" />
              </a>
            ) : (
              <div key={p} className="w-20 h-20 rounded-lg bg-bg-deep animate-pulse flex-shrink-0" />
            )
          )}
        </div>
      )}
    </div>
  );
}
