import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { TabletHeader } from '@/components/layout/TabletHeader';
import { TicketCard, type TicketSummary } from '@/components/tickets/TicketCard';
import { useNombreNotes } from '@/hooks/queries/useNotesPartagees';
import { ModaleReassignerTicket } from '@/components/tickets/ModaleReassignerTicket';
import { Pill } from '@/components/ui/Pill';
import { cn, estCheminVideo, formatDateCourt } from '@/lib/utils';
import { useIncidents, useNombreTicketsParParc, useTicketsAValider, useValiderTicket } from '@/hooks/queries/useTickets';
import { ModaleSupprimerTicket } from '@/components/tickets/ModaleSupprimerTicket';
import { ModaleRefuserTicket } from '@/components/tickets/ModaleRefuserTicket';
import { ModaleClotureRapide } from '@/components/tickets/ModaleClotureRapide';
import { useTechnicienKartingEffectif } from '@/hooks/useViewAs';
import { peutValiderTicket, voitDemandesPrestataires, voitToutLeParc } from '@/lib/acces';
import { useAuth } from '@/hooks/useAuth';
import { TachesAValider } from '@/components/TachesAValider';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useToast } from '@/components/ui/ToastProvider';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import type { Criticite } from '@/types/database';
import { useParcSelectionne } from '@/hooks/useParcCourant';
import { useEtatUrl } from '@/hooks/useEtatUrl';
import { ModaleRouvrirTicket } from '@/components/tickets/ModaleRouvrirTicket';
import { useDemandesEnCours } from '@/hooks/queries/useDemandesEnCours';
import { ListeDemandesPresta } from '@/components/tickets/ListeDemandesPresta';

type Onglet = 'a_valider' | 'tickets' | 'resolus' | 'demandes' | 'controles' | 'preventif';

/** Anciens onglets par statut (liens et adresses gardés) : tous regroupés dans « Tickets » */
const ANCIENS_ONGLETS = ['a_faire', 'en_cours', 'attente_piece', 'exterieur'];

/** Groupes d'un ticket ouvert, dans l'ordre d'affichage au sein de chaque activité */
type Groupe = 'a_faire' | 'en_cours' | 'attente_piece' | 'exterieur';
const GROUPES: { code: Groupe; label: string }[] = [
  { code: 'a_faire', label: 'À faire' },
  { code: 'en_cours', label: 'En cours' },
  { code: 'attente_piece', label: 'Pièce en attente' },
  { code: 'exterieur', label: 'Extérieur' },
];
function groupeIncident(i: Record<string, unknown>): Groupe {
  if (i.externe === true) return 'exterieur';
  if (i.attente_piece === true) return 'attente_piece';
  if (i.statut === 'en_cours') return 'en_cours';
  return 'a_faire';
}

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

function incidentToTicket(inc: Record<string, unknown>, categories?: Map<string, { nom: string; activite: string | null }>): TicketSummary {
  const equip = inc.equipements as Record<string, unknown> | null;
  const priorite = inc.niveaux_priorite as Record<string, unknown> | null;
  const zone = equip?.zones as Record<string, unknown> | null;
  const parc = equip?.parcs as Record<string, unknown> | null;
  // Équipement saisi à la main (pas d'équipement) : catégorie choisie au signalement
  const catSignalee = categories?.get(((inc.meta as Record<string, unknown> | null)?.categorie_id as string | undefined) ?? '');
  const cat = (equip?.categories_equipement as Record<string, unknown> | null) ?? (catSignalee as Record<string, unknown> | undefined) ?? null;
  const criticite = mapCriticite(priorite);
  const declareLe = inc.declare_le as string;

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

  return {
    id: inc.id as string,
    numeroBT: inc.numero_bt as string,
    criticite,
    // Titre : activité · pièce en panne
    titre: [cat?.activite as string | undefined, (equip?.libelle as string | undefined) ?? (inc.titre as string | undefined)]
      .filter(Boolean)
      .join(' · '),
    zone: (zone?.nom as string) ?? undefined,
    activite: (cat?.activite as string | undefined) ?? (cat?.nom as string | undefined) ?? 'Équipement non précisé',
    description: inc.statut === 'ouvert' && criticite === 'bloquant'
      ? `${equip?.code as string ?? ''} · signalé ${formatDateCourt(declareLe)}`
      : undefined,
    badges: badges.length > 0 ? badges : undefined,
    declareLe,
    meta: [(parc?.code ?? inc.parc_ticket_code) as string | undefined, inc.numero_bt as string, `le ${formatDateCourt(declareLe)}`, inc.declare_par_nom ? `par ${inc.declare_par_nom as string}` : null]
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
  // Onglet, parc et filtres gardés dans l'adresse : le retour depuis un ticket les retrouve
  const [ongletUrl, setOnglet] = useEtatUrl<string>('onglet', 'tickets');
  const onglet = (ANCIENS_ONGLETS.includes(ongletUrl) ? 'tickets' : ongletUrl) as Onglet;
  // Catégories (activité des tickets signalés sans équipement)
  const { data: categories } = useQuery({
    queryKey: ['categories_equipement', 'activites'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories_equipement').select('id, nom, activite');
      if (error) throw error;
      return new Map((data ?? []).map((c) => [c.id as string, { nom: c.nom as string, activite: (c.activite as string | null) ?? null }]));
    },
  });
  const [zoneFiltre, setZoneFiltre] = useEtatUrl<string>('zone', 'toutes');
  const [activiteFiltre, setActiviteFiltre] = useEtatUrl<string>('activite', 'toutes');
  // Parc : celui choisi en haut à gauche, sauf si un autre a été choisi sur la page
  const parcGlobal = useParcSelectionne();
  const [parcUrl, setParcUrl] = useEtatUrl<string>('parc', '');
  const parcActif = parcUrl === '' ? parcGlobal : parcUrl === 'tous' ? null : parcUrl;
  const setParcActif = (id: string | null) => setParcUrl(id ?? 'tous');
  const [reassignerCible, setReassignerCible] = useState<{ id: string; numeroBT: string } | null>(null);
  const [suppressionCible, setSuppressionCible] = useState<{ id: string; numeroBT: string } | null>(null);
  const [refusCible, setRefusCible] = useState<{ id: string; numeroBT: string } | null>(null);
  const [clotureCible, setClotureCible] = useState<{ id: string; numeroBT: string } | null>(null);
  // Réouverture d'un ticket résolu, depuis l'onglet « Résolus » (chef d'équipe)
  const [reouvertureCible, setReouvertureCible] = useState<{ id: string; numeroBT: string } | null>(null);
  const validerTicket = useValiderTicket();
  // Managers de parc : suivi des tickets en lecture seule (ni démarrage, ni réassignation)
  // Directeurs et managers : suivi des tickets sans action d'intervention
  // (sauf autorisation « peut intervenir » sur leurs parcs)
  const lectureSeule =
    (utilisateur?.role_code === 'manager_parc' || utilisateur?.role_code === 'directeur_parc') && !utilisateur?.peut_intervenir;

  // Problème signalé affiché sur les cartes : directeurs de parc, techniciens et chef d'équipe
  const sansProblemeSiNonDirecteur = (t: TicketSummary): TicketSummary =>
    ['directeur_parc', 'technicien', 'chef_maintenance'].includes(utilisateur?.role_code ?? '') ? t : { ...t, probleme: undefined };

  // Valideurs (et suppression) : chef d'équipe, direction, admin IT, directeurs de parc
  // Onglet « À valider » : valideurs, et managers en lecture (tout ce qui se passe dans leur parc)
  const estValideur = ['direction', 'chef_maintenance', 'admin_it', 'directeur_parc'].includes(utilisateur?.role_code ?? '') || voitToutLeParc(utilisateur);

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

  const statutsFiltres = onglet === 'resolus'
    ? ['resolu' as const, 'ferme' as const]
    : ['ouvert' as const, 'assigne' as const, 'en_pause' as const, 'en_cours' as const];

  const incidentsQ = useIncidents({
    parcId: parcIdEffectif,
    statuts: statutsFiltres,
  });

  const allIncidentsQ = useIncidents({
    parcId: parcIdEffectif,
  });

  // Demandes spécifiques et prestataires en cours (directeurs de parc, managers principaux, chef d'équipe, direction, admin IT)
  const voitDemandes = voitDemandesPrestataires(utilisateur);
  const karting = useTechnicienKartingEffectif(utilisateur);
  const demandesQ = useDemandesEnCours(voitDemandes);
  const demandes = useMemo(
    () => (demandesQ.data ?? []).filter((d) => !parcIdEffectif || d.parc_id === parcIdEffectif),
    [demandesQ.data, parcIdEffectif]
  );

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
          return (!parcIdEffectif || parcId === parcIdEffectif) && (peutValiderTicket(utilisateur, parcId) || voitToutLeParc(utilisateur, parcId));
        })
        .map((i) => incidentToTicket(i, categories))
        .map(sansProblemeSiNonDirecteur),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aValiderQ.data, parcIdEffectif, utilisateur, categories]
  );

  const valider = (t: TicketSummary) =>
    validerTicket.mutate(t.id, {
      onSuccess: () => toast.success(`Ticket ${t.numeroBT} validé : il est dans Opérations`),
      onError: (e) => toast.error((e as Error).message),
    });

  const tickets = useMemo(() => {
    if (!incidentsQ.data) return [];
    return (incidentsQ.data as Record<string, unknown>[])
      .map((i) => incidentToTicket(i, categories))
      .map(sansProblemeSiNonDirecteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentsQ.data, onglet, utilisateur?.role_code, categories]);

  // Groupe de chaque ticket ouvert (À faire, En cours, Pièce en attente, Extérieur)
  const groupeParTicket = useMemo(
    () => new Map(((incidentsQ.data ?? []) as Record<string, unknown>[]).map((i) => [i.id as string, groupeIncident(i)])),
    [incidentsQ.data]
  );

  const { data: nbNotes } = useNombreNotes(
    'ticket',
    tickets.map((t) => t.id)
  );

  // Activités présentes dans l'onglet, avec leur nombre de tickets (ordre alphabétique)
  const activites = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach((t) => m.set(t.activite ?? '', (m.get(t.activite ?? '') ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
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

  const ticketsZone = ticketsActivite
    .filter((t) => zoneFiltre === 'toutes' || t.zone === zoneFiltre)
    // Pastille « 💬 » : le ticket a des notes
    .map((t) => (nbNotes?.[t.id] ? { ...t, badges: [...(t.badges ?? []), { label: `💬 ${nbNotes[t.id]}` }] } : t));

  // Vignette de la photo du problème (URLs signées en un seul appel)
  const { data: urlsPhotos } = useSignedUrls(
    ticketsZone.map((t) => t.photoPath),
    'alba-incidents'
  );
  const ticketsFiltres = ticketsZone.map((t) => (t.photoPath && urlsPhotos?.[t.photoPath] ? { ...t, photoUrl: urlsPhotos[t.photoPath] } : t));

  // Clôture groupée : sélection de plusieurs tickets ouverts, clôturés avec un
  // seul rapport (le premier coché porte le rapport, les autres « même cause »)
  const [modeSelection, setModeSelection] = useState(false);
  const [selection, setSelection] = useState<TicketSummary[]>([]);
  const selectionPossible =
    !lectureSeule && onglet === 'tickets';
  const basculerSelection = (t: TicketSummary) =>
    setSelection((sel) => (sel.some((x) => x.id === t.id) ? sel.filter((x) => x.id !== t.id) : [...sel, t]));
  const quitterSelection = () => {
    setModeSelection(false);
    setSelection([]);
  };
  const cloturerSelection = () => {
    const [principal, ...autresSel] = selection;
    if (!principal) return;
    const lies = autresSel.map((t) => t.id).join(',');
    navigate(`/tech/operations/${principal.numeroBT}${lies ? `?lies=${lies}` : ''}`);
  };

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


  const parActivite = useMemo(() => {
    const m = new Map<string, TicketSummary[]>();
    ticketsFiltres.forEach((t) => m.set(t.activite ?? '', [...(m.get(t.activite ?? '') ?? []), t]));
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
      .map(([activite, liste]) => ({
        activite,
        total: liste.length,
        groupes: GROUPES.map((g) => ({
          ...g,
          // À faire : les plus anciens d'abord ; ailleurs, les plus récents
          liste: liste
            .filter((t) => (groupeParTicket.get(t.id) ?? 'a_faire') === g.code)
            .sort((a, b) => (g.code === 'a_faire' ? (a.declareLe ?? '').localeCompare(b.declareLe ?? '') : (b.declareLe ?? '').localeCompare(a.declareLe ?? ''))),
        })).filter((g) => g.liste.length > 0),
      }));
  }, [ticketsFiltres, groupeParTicket]);
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

      {/* Tâches récurrentes à valider (ex. envoi de pièce du laser game le vendredi) */}
      <div className="px-3 md:px-[18px] pt-3 bg-bg-deep empty:hidden">
        <TachesAValider variante="bandeau" />
      </div>

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
          {
            code: 'tickets' as Onglet,
            label: 'Tickets',
            badge: compteurs.aFaire + compteurs.enCours + compteurs.attentePiece + compteurs.exterieur,
            badgeTone: 'white',
          },
          { code: 'resolus' as Onglet, label: 'Résolus', badge: compteurs.resolus, badgeTone: 'white' },
          ...(voitDemandes
            ? [{ code: 'demandes' as Onglet, label: 'Demandes presta', badge: demandes.length, badgeTone: 'amber' }]
            : []),
          // Technicien Karting : uniquement les tickets karting
          ...(karting
            ? []
            : [
                { code: 'controles' as Onglet, label: 'Contrôles' },
                { code: 'preventif' as Onglet, label: 'Préventif' },
              ]),
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

      {onglet !== 'demandes' && activites.length > 0 && (
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

      {onglet !== 'demandes' && (
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
      )}

      {selectionPossible && ticketsFiltres.length > 1 && (
        <div className="px-3 md:px-[18px] pt-3 flex items-center gap-2 flex-wrap">
          {modeSelection ? (
            <>
              <span className="text-[12px] text-dim flex-1">
                Coche les tickets réglés par la même réparation. Le premier coché porte le rapport.
              </span>
              <button
                onClick={quitterSelection}
                className="px-4 rounded-[10px] text-[12px] min-h-[40px] bg-bg-card border border-white/[0.08] text-dim"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              onClick={() => setModeSelection(true)}
              className="px-4 rounded-[10px] text-[12px] font-semibold min-h-[40px] bg-bg-card border border-nikito-cyan/40 text-nikito-cyan"
            >
              ☑️ Sélectionner plusieurs tickets
            </button>
          )}
        </div>
      )}

      <div className="p-3 px-3 md:p-3.5 md:px-[18px] flex flex-col gap-2.5">
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
                  {peutValiderTicket(utilisateur, t.parcId) ? (
                    <>
                      <button
                        onClick={() => setRefusCible({ id: t.id, numeroBT: t.numeroBT })}
                        className="px-4 rounded-[10px] text-[12px] font-semibold min-h-[40px] bg-bg-card border border-red/40 text-red"
                      >
                        ✕ Refuser
                      </button>
                      <button
                        onClick={() => valider(t)}
                        disabled={validerTicket.isPending}
                        className="px-4 rounded-[10px] text-[12px] font-bold min-h-[40px] bg-gradient-cta text-text disabled:opacity-50"
                      >
                        ✓ Valider
                      </button>
                    </>
                  ) : (
                    <span className="text-[12px] text-dim self-center">En attente de validation par le directeur de parc ou un manager principal</span>
                  )}
                </div>
              </div>
            ))
          )
        ) : onglet === 'demandes' ? (
          demandesQ.isLoading ? (
            <div className="text-center py-12 text-dim text-sm">Chargement…</div>
          ) : (
            <ListeDemandesPresta demandes={demandes} />
          )
        ) : onglet === 'controles' || onglet === 'preventif' ? (
          <div className="text-center py-12 text-dim text-sm">
            {onglet === 'controles' ? 'Contrôles à venir' : 'Préventif à venir'}
          </div>
        ) : ticketsFiltres.length === 0 ? (
          <div className="text-center py-12 text-dim text-sm">
            Aucun ticket {onglet === 'resolus' ? 'résolu' : 'à traiter'}
          </div>
        ) : modeSelection && selectionPossible ? (
          <>
            {ticketsFiltres.map((t) => {
              const rang = selection.findIndex((x) => x.id === t.id);
              return (
                <div
                  key={t.numeroBT}
                  className={cn(
                    'flex items-stretch gap-2 rounded-xl border p-1.5',
                    rang >= 0 ? 'border-nikito-cyan/60 bg-nikito-cyan/[0.06]' : 'border-transparent'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => basculerSelection(t)}
                    aria-label={rang >= 0 ? `Retirer ${t.numeroBT}` : `Sélectionner ${t.numeroBT}`}
                    className={cn(
                      'w-11 flex-shrink-0 rounded-lg flex items-center justify-center text-[13px] font-bold',
                      rang >= 0 ? 'bg-nikito-cyan text-bg-app' : 'bg-bg-card border border-white/15 text-dim'
                    )}
                  >
                    {rang >= 0 ? rang + 1 : ''}
                  </button>
                  <div className="flex-1 min-w-0">
                    <TicketCard ticket={t} variant="compact" onClick={() => basculerSelection(t)} />
                  </div>
                </div>
              );
            })}
            {selection.length > 0 && (
              <div className="sticky bottom-3 z-10 mt-1 flex items-center gap-2 rounded-2xl bg-bg-card border border-nikito-cyan/40 p-2.5 shadow-lg">
                <span className="text-[13px] flex-1 pl-1">
                  {selection.length} ticket{selection.length > 1 ? 's' : ''} sélectionné{selection.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={cloturerSelection}
                  className="px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] bg-gradient-cta text-text"
                >
                  {selection.length > 1 ? `Clôturer les ${selection.length} ensemble` : 'Ouvrir pour clôturer'}
                </button>
              </div>
            )}
          </>
        ) : onglet === 'resolus' ? (
          <>
            {ticketsFiltres.map((t) => (
              <TicketCard
                key={t.numeroBT}
                ticket={t}
                variant="compact"
                onClick={() => navigate(`/tech/operations/${t.numeroBT}`)}
                onSupprimer={supprimerSiAutorise(t)}
                onCloturer={onglet === 'resolus' ? undefined : cloturerSiAutorise(t)}
                onRouvrir={
                  onglet === 'resolus' && utilisateur?.role_code === 'chef_maintenance'
                    ? () => setReouvertureCible({ id: t.id, numeroBT: t.numeroBT })
                    : undefined
                }
              />
            ))}
          </>
        ) : (
          // Rangés par activité, puis dans chaque activité : À faire, En cours, Pièce en attente, Extérieur
          <>
            {parActivite.map(({ activite, total, groupes }) => (
              <section key={activite} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-2">
                  <h2 className="text-[15px] font-semibold">{activite}</h2>
                  <span className="text-[12px] text-dim">{total} ticket{total > 1 ? 's' : ''}</span>
                </div>
                {groupes.map(({ code, label, liste }) => (
                  <div key={code} className="flex flex-col gap-1.5 pl-2 border-l-2 border-white/[0.06]">
                    <div className={cn('text-[11px] uppercase tracking-wider', code === 'a_faire' ? 'text-dim' : 'text-amber')}>
                      {label} · {liste.length}
                    </div>
                    {liste.map((t) => (
                      <TicketCard
                        key={t.numeroBT}
                        ticket={t}
                        variant="compact"
                        onClick={() => navigate(`/tech/operations/${t.numeroBT}`)}
                        onReassigner={
                          lectureSeule || code !== 'a_faire' ? undefined : () => setReassignerCible({ id: t.id, numeroBT: t.numeroBT })
                        }
                        onSupprimer={supprimerSiAutorise(t)}
                        onCloturer={cloturerSiAutorise(t)}
                      />
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </>
        )}
      </div>

      {reouvertureCible && (
        <ModaleRouvrirTicket incidentId={reouvertureCible.id} numeroBT={reouvertureCible.numeroBT} onClose={() => setReouvertureCible(null)} />
      )}
      {clotureCible && (
        <ModaleClotureRapide incidentId={clotureCible.id} numeroBT={clotureCible.numeroBT} onClose={() => setClotureCible(null)} />
      )}

      {refusCible && (
        <ModaleRefuserTicket incidentId={refusCible.id} numeroBT={refusCible.numeroBT} onClose={() => setRefusCible(null)} />
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
