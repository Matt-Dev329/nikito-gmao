import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { dateParis } from '@/lib/dates';
import { chargerToutesLesPages } from '@/lib/paginer';
import { useAuth } from '@/hooks/useAuth';
import { useFormationFilter } from '@/hooks/useFormation';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import { ROLES_RAPPORTS } from './PageRapportsReparation';

interface InterventionBon {
  id: string;
  debut: string | null;
  fin: string | null;
  diagnostic: string | null;
  actions_realisees: string | null;
  resolu_premier_coup: boolean | null;
  technicien_id: string | null;
  photos_avant: string[] | null;
  photos_apres: string[] | null;
  pieces_utilisees: { quantite: number; pieces_detachees: { nom: string; reference: string } | null }[] | null;
}

interface Bon {
  id: string;
  numero_bt: string;
  titre: string;
  statut: string;
  declare_le: string | null;
  resolu_le: string | null;
  assigne_a_id: string | null;
  externe: boolean | null;
  attente_piece: boolean | null;
  equipements: {
    code: string | null;
    libelle: string | null;
    parcs: { code: string; nom: string } | null;
    zones: { nom: string } | null;
    categories_equipement: { nom: string | null; activite: string | null } | null;
  } | null;
  niveaux_priorite: { code: string | null; nom: string | null } | null;
  interventions: InterventionBon[] | null;
}

type Etat = 'a_faire' | 'en_cours' | 'termine';

const ETATS: { code: Etat | 'tous'; label: string }[] = [
  { code: 'tous', label: 'Tous' },
  { code: 'a_faire', label: 'À faire' },
  { code: 'en_cours', label: 'En cours' },
  { code: 'termine', label: 'Terminés' },
];

const PERIODES = [
  { code: '7', label: '7 jours', jours: 7 },
  { code: '30', label: '30 jours', jours: 30 },
  { code: '90', label: '3 mois', jours: 90 },
  { code: '365', label: '1 an', jours: 365 },
];

function etatDe(b: Bon): Etat {
  if (b.statut === 'resolu' || b.statut === 'ferme') return 'termine';
  if (b.statut === 'en_cours') return 'en_cours';
  return 'a_faire';
}

const BADGE: Record<Etat, { label: string; classe: string }> = {
  a_faire: { label: 'À faire', classe: 'bg-amber/15 text-amber' },
  en_cours: { label: 'En cours', classe: 'bg-nikito-cyan/15 text-nikito-cyan' },
  termine: { label: 'Terminé', classe: 'bg-green/15 text-green' },
};

function activiteDe(b: Bon): string {
  return b.equipements?.categories_equipement?.activite || 'Autres';
}

function derniereIntervention(b: Bon): InterventionBon | null {
  const liste = [...(b.interventions ?? [])].sort((x, y) => (y.debut ?? '').localeCompare(x.debut ?? ''));
  return liste[0] ?? null;
}

function useBons(jours: number) {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['bons-intervention', jours, estFormation],
    queryFn: async () => {
      const depuis = dateParis(Date.now() - jours * 86_400_000);
      const bons = await chargerToutesLesPages<Bon>((debut, fin) =>
        supabase
          .from('incidents')
          .select(
            `id, numero_bt, titre, statut, declare_le, resolu_le, assigne_a_id, externe, attente_piece,
            equipements(code, libelle, parcs(code, nom), zones(nom), categories_equipement(nom, activite)),
            niveaux_priorite(code, nom),
            interventions(id, debut, fin, diagnostic, actions_realisees, resolu_premier_coup, technicien_id, photos_avant, photos_apres,
              pieces_utilisees(quantite, pieces_detachees(nom, reference)))`
          )
          .eq('est_formation', estFormation)
          .eq('est_brouillon', false)
          .neq('statut', 'annule')
          .gte('declare_le', depuis)
          .order('declare_le', { ascending: false })
          .order('id')
          .range(debut, fin)
      );

      // Noms des techniciens (visibles selon les droits de chacun)
      const ids = [
        ...new Set(
          bons.flatMap((b) => [b.assigne_a_id, ...(b.interventions ?? []).map((i) => i.technicien_id)]).filter(Boolean) as string[]
        ),
      ];
      const noms = new Map<string, string>();
      if (ids.length) {
        const { data } = await supabase.from('utilisateurs').select('id, prenom, nom').in('id', ids);
        (data ?? []).forEach((u: { id: string; prenom: string | null; nom: string | null }) =>
          noms.set(u.id, [u.prenom, u.nom].filter(Boolean).join(' '))
        );
      }
      return { bons, noms };
    },
  });
}

/** Bons d'intervention : tous les tickets (à faire, en cours, terminés) et leur bon en PDF. */
export function PageBonsIntervention() {
  const { utilisateur } = useAuth();
  if (utilisateur && !ROLES_RAPPORTS.includes(utilisateur.role_code)) return <Navigate to="/" replace />;
  return <ContenuBons />;
}

function ContenuBons() {
  const [periode, setPeriode] = useState('30');
  const [etat, setEtat] = useState<Etat | 'tous'>('tous');
  const [activite, setActivite] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const jours = PERIODES.find((p) => p.code === periode)?.jours ?? 30;
  const { data, isLoading, isError, error } = useBons(jours);
  const bons = useMemo(() => data?.bons ?? [], [data]);
  const noms = data?.noms;

  const parEtat = useMemo(() => bons.filter((b) => etat === 'tous' || etatDe(b) === etat), [bons, etat]);

  const activites = useMemo(() => {
    const m = new Map<string, number>();
    parEtat.forEach((b) => m.set(activiteDe(b), (m.get(activiteDe(b)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) =>
      a[0] === 'Autres' ? 1 : b[0] === 'Autres' ? -1 : a[0].localeCompare(b[0], 'fr')
    );
  }, [parEtat]);
  const activiteActive = activite && activites.some(([a]) => a === activite) ? activite : null;

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return parEtat.filter(
      (b) =>
        (!activiteActive || activiteDe(b) === activiteActive) &&
        (!q ||
          [b.numero_bt, b.titre, b.equipements?.libelle, b.equipements?.code, b.equipements?.parcs?.code, b.equipements?.parcs?.nom]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q))
    );
  }, [parEtat, activiteActive, recherche]);

  const groupes = useMemo(() => {
    const m = new Map<string, Bon[]>();
    filtres.forEach((b) => m.set(activiteDe(b), [...(m.get(activiteDe(b)) ?? []), b]));
    return [...m.entries()].sort((a, b) =>
      a[0] === 'Autres' ? 1 : b[0] === 'Autres' ? -1 : a[0].localeCompare(b[0], 'fr')
    );
  }, [filtres]);

  const compte = (code: Etat | 'tous') => (code === 'tous' ? bons.length : bons.filter((b) => etatDe(b) === code).length);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <h1 className="text-xl md:text-[22px] font-semibold m-0">Bons d'intervention</h1>
      <p className="text-[13px] text-dim mt-1 mb-4">
        Tous les tickets de la période avec leur bon d'intervention à télécharger ou imprimer
      </p>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ETATS.map((e) => (
            <Pill key={e.code} active={etat === e.code} onClick={() => setEtat(e.code)}>
              {e.label} <span className="opacity-60">· {compte(e.code)}</span>
            </Pill>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PERIODES.map((p) => (
            <Pill key={p.code} active={periode === p.code} onClick={() => setPeriode(p.code)}>
              {p.label}
            </Pill>
          ))}
        </div>
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (BT, équipement, parc…)"
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
        />
        {activites.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={!activiteActive} onClick={() => setActivite(null)}>
              Toutes <span className="opacity-60">· {parEtat.length}</span>
            </Pill>
            {activites.map(([a, n]) => (
              <Pill key={a} variant="cyan" active={activiteActive === a} onClick={() => setActivite(a)}>
                {a} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : groupes.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">Aucun bon d'intervention sur cette période.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupes.map(([act, liste]) => (
            <section key={act}>
              <h2 className="text-[13px] text-dim uppercase tracking-wider mb-2">
                {act} <span className="text-faint">· {liste.length}</span>
              </h2>
              <div className="flex flex-col gap-2.5">
                {liste.map((b) => (
                  <CarteBon key={b.id} bon={b} noms={noms} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CarteBon({ bon: b, noms }: { bon: Bon; noms?: Map<string, string> }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [pdfEnCours, setPdfEnCours] = useState(false);
  const etat = etatDe(b);
  const derniere = derniereIntervention(b);
  const activite = b.equipements?.categories_equipement?.activite ?? null;
  const equipement = b.equipements?.libelle || b.titre;
  const titre = [activite, equipement].filter(Boolean).join(' · ');
  const technicienId = derniere?.technicien_id ?? b.assigne_a_id;
  const technicien = (technicienId && noms?.get(technicienId)) || '';

  const telechargerBon = async () => {
    setPdfEnCours(true);
    try {
      const { exportInterventionPDF } = await import('@/pages/technicien/exportInterventionPDF');
      const code = b.niveaux_priorite?.code ?? '';
      await exportInterventionPDF({
        numeroBT: b.numero_bt,
        titre,
        equipementLibelle: equipement ?? '',
        equipementCode: b.equipements?.code ?? '',
        parcNom: b.equipements?.parcs?.nom ?? '',
        zoneNom: b.equipements?.zones?.nom ?? '',
        criticite: code === 'bloquant' || code === 'majeur' ? code : 'mineur',
        diagnostic: derniere?.diagnostic ?? '',
        actions: derniere?.actions_realisees ?? '',
        resoluPremierCoup: derniere?.resolu_premier_coup ?? null,
        debut: derniere?.debut ?? null,
        fin: derniere?.fin ?? null,
        technicienNom: technicien,
        pieces: (b.interventions ?? []).flatMap((i) =>
          (i.pieces_utilisees ?? []).map((p) => ({
            nom: p.pieces_detachees?.nom ?? 'Pièce',
            reference: p.pieces_detachees?.reference ?? '',
            quantite: p.quantite,
          }))
        ),
        photoBucket: 'alba-interventions',
        photoAvantPath: derniere?.photos_avant?.[0] ?? null,
        photoApresPath: derniere?.photos_apres?.[0] ?? null,
      });
    } catch (e) {
      toast.error(`Bon impossible à générer : ${(e as Error).message}`);
    } finally {
      setPdfEnCours(false);
    }
  };

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06] p-3.5 px-4">
      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold truncate">{titre}</div>
          <div className="text-[12px] text-dim mt-0.5">
            <span className="font-mono">{b.numero_bt}</span>
            {b.equipements?.parcs?.code ? ` · ${b.equipements.parcs.code}` : ''}
            {b.declare_le
              ? ` · ${new Date(b.declare_le).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
              : ''}
            {technicien ? ` · ${technicien}` : ''}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={cn('text-[10px] px-2 py-0.5 rounded', BADGE[etat].classe)}>{BADGE[etat].label}</span>
          {b.externe && <span className="text-[10px] bg-amber/15 text-amber px-2 py-0.5 rounded">Extérieur</span>}
          {b.attente_piece && <span className="text-[10px] bg-red/15 text-red px-2 py-0.5 rounded">Pièce en attente</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => navigate(`/gmao/operations/${b.numero_bt}`)}
          className="bg-bg-deep border border-white/[0.08] px-4 rounded-[10px] text-[13px] min-h-[44px]"
        >
          Voir le ticket
        </button>
        <button
          onClick={telechargerBon}
          disabled={pdfEnCours}
          className="bg-nikito-cyan/15 text-nikito-cyan border border-nikito-cyan/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
        >
          {pdfEnCours ? 'PDF…' : '⬇ Bon d’intervention (PDF)'}
        </button>
      </div>
    </div>
  );
}
