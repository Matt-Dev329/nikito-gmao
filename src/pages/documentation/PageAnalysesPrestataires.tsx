import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import { recollerDocument } from '@/lib/envoiGrosFichier';
import { ROLES_PILOTAGE, aAcces } from '@/lib/acces';

interface PointConforme {
  intitule: string;
  detail: string | null;
}
interface PointNonConforme extends PointConforme {
  gravite: 'bloquante' | 'majeure' | 'mineure';
  action: string | null;
}
interface Analyse {
  statut: 'en_attente' | 'en_cours' | 'terminee' | 'echec';
  resultat_global: 'conforme' | 'conforme_avec_reserves' | 'non_conforme' | 'indetermine' | null;
  resume: string | null;
  points_conformes: PointConforme[];
  points_non_conformes: PointNonConforme[];
  date_controle: string | null;
  prochaine_echeance: string | null;
  periodicite: string | null;
  erreur: string | null;
  analyse_le: string | null;
}
interface RapportAnalyse {
  id: string;
  titre: string;
  activite: string | null;
  prestataire: string | null;
  chemin: string;
  mime: string | null;
  parties: number | null;
  date_document: string | null;
  prochaine_echeance: string | null;
  cree_le: string;
  parc: { code: string; nom: string } | null;
  analyse: Analyse | Analyse[] | null;
}

const RESULTATS: Record<string, { label: string; classe: string }> = {
  conforme: { label: 'Conforme', classe: 'bg-green/15 text-green' },
  conforme_avec_reserves: { label: 'Conforme avec réserves', classe: 'bg-amber/15 text-amber' },
  non_conforme: { label: 'Non conforme', classe: 'bg-red/15 text-red' },
  indetermine: { label: 'Indéterminé', classe: 'bg-white/[0.06] text-dim' },
};
const GRAVITES: Record<string, string> = { bloquante: 'text-red', majeure: 'text-amber', mineure: 'text-dim' };
const ORDRE_GRAVITE: Record<string, number> = { bloquante: 0, majeure: 1, mineure: 2 };

type Filtre = 'tous' | 'a_corriger' | 'a_renouveler' | 'conformes';

const analyseDe = (r: RapportAnalyse): Analyse | null => (Array.isArray(r.analyse) ? r.analyse[0] ?? null : r.analyse);
const echeanceDe = (r: RapportAnalyse) => r.prochaine_echeance ?? analyseDe(r)?.prochaine_echeance ?? null;
const joursAvant = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

function useAnalyses() {
  return useQuery({
    queryKey: ['analyses-prestataires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents_techniques')
        .select(
          `id, titre, activite, prestataire, chemin, mime, parties, date_document, prochaine_echeance, cree_le,
          parc:parcs(code, nom), analyse:analyses_rapports_prestataires(*)`
        )
        .eq('type', 'prestataire')
        .eq('actif', true)
        .order('date_document', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RapportAnalyse[];
    },
    // Rafraîchit tant qu'une analyse tourne
    refetchInterval: (q) =>
      (q.state.data ?? []).some((r) => ['en_attente', 'en_cours'].includes(analyseDe(r)?.statut ?? '')) ? 5000 : false,
  });
}

/** Synthèse des rapports prestataires : points conformes / non conformes et renouvellements. */
export function PageAnalysesPrestataires() {
  const { utilisateur } = useAuth();
  if (utilisateur && !aAcces(utilisateur, ROLES_PILOTAGE)) return <Navigate to="/" replace />;
  return <ContenuAnalyses />;
}

function ContenuAnalyses() {
  const { data: rapports, isLoading, isError, error } = useAnalyses();
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState<string | null>(null);
  // Mode « mail de réparation » : rapports cochés
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [mailOuvert, setMailOuvert] = useState(false);
  const basculer = (id: string) =>
    setSelection((s) => {
      const n = new Set(s ?? []);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const categorieDe = (r: RapportAnalyse) => r.activite?.trim() || 'À classer';

  const aCorriger = (r: RapportAnalyse) => (analyseDe(r)?.points_non_conformes ?? []).length > 0;
  const aRenouveler = (r: RapportAnalyse) => {
    const e = echeanceDe(r);
    return !!e && joursAvant(e) <= 60;
  };

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (rapports ?? [])
      .filter((r) =>
        filtre === 'a_corriger'
          ? aCorriger(r)
          : filtre === 'a_renouveler'
            ? aRenouveler(r)
            : filtre === 'conformes'
              ? analyseDe(r)?.resultat_global === 'conforme'
              : true
      )
      .filter((r) => !categorie || categorieDe(r) === categorie)
      .filter(
        (r) =>
          !q ||
          [r.titre, r.activite, r.prestataire, r.parc?.code, r.parc?.nom, analyseDe(r)?.resume].filter(Boolean).join(' ').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // Bloquants / non conformes d'abord, puis échéances les plus proches
        const rang = (r: RapportAnalyse) => {
          const res = analyseDe(r)?.resultat_global;
          return res === 'non_conforme' ? 0 : res === 'conforme_avec_reserves' ? 1 : 2;
        };
        if (rang(a) !== rang(b)) return rang(a) - rang(b);
        return (echeanceDe(a) ?? '9999').localeCompare(echeanceDe(b) ?? '9999');
      });
  }, [rapports, filtre, recherche, categorie]);

  // Catégories créées au fil des analyses (rangement automatique)
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    (rapports ?? []).forEach((r) => m.set(categorieDe(r), (m.get(categorieDe(r)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => (a[0] === 'À classer' ? 1 : b[0] === 'À classer' ? -1 : a[0].localeCompare(b[0], 'fr')));
  }, [rapports]);
  const groupes = useMemo(() => {
    const m = new Map<string, RapportAnalyse[]>();
    liste.forEach((r) => m.set(categorieDe(r), [...(m.get(categorieDe(r)) ?? []), r]));
    return [...m.entries()].sort((a, b) => (a[0] === 'À classer' ? 1 : b[0] === 'À classer' ? -1 : a[0].localeCompare(b[0], 'fr')));
  }, [liste]);

  const compte = (f: Filtre) =>
    (rapports ?? []).filter((r) =>
      f === 'a_corriger' ? aCorriger(r) : f === 'a_renouveler' ? aRenouveler(r) : f === 'conformes' ? analyseDe(r)?.resultat_global === 'conforme' : true
    ).length;

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Analyses prestataires</h1>
          <p className="text-[13px] text-dim mt-1">
            Lecture automatique de chaque rapport déposé : ce qui est bon, ce qui ne l’est pas, et quand renouveler le contrôle
          </p>
        </div>
        <button
          onClick={() => setSelection((s) => (s ? null : new Set()))}
          className={cn(
            'px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px] border',
            selection ? 'bg-bg-deep border-white/[0.08] text-dim' : 'bg-nikito-cyan/15 text-nikito-cyan border-nikito-cyan/40'
          )}
        >
          {selection ? 'Annuler la sélection' : '✉️ Mail de réparation'}
        </button>
      </div>

      {selection && (
        <div className="bg-nikito-cyan/[0.06] border border-nikito-cyan/30 rounded-xl p-3 mb-4 text-[13px] flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">Coche les rapports dont il faut faire réparer les points non conformes, puis prépare le mail.</div>
          <button
            onClick={() => setSelection(new Set((rapports ?? []).filter(aCorriger).map((r) => r.id)))}
            className="text-nikito-cyan text-[12px] font-semibold min-h-[36px]"
          >
            Tout cocher (à corriger)
          </button>
          <button
            onClick={() => setMailOuvert(true)}
            disabled={selection.size === 0}
            className={cn('bg-nikito-cyan text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[44px]', selection.size === 0 && 'opacity-40')}
          >
            Préparer le mail ({selection.size})
          </button>
        </div>
      )}
      {mailOuvert && selection && <ModaleMailReparation ids={[...selection]} onClose={() => setMailOuvert(false)} />}

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(
            [
              ['tous', 'Tous'],
              ['a_corriger', 'À corriger'],
              ['a_renouveler', 'À renouveler (60 j)'],
              ['conformes', 'Conformes'],
            ] as [Filtre, string][]
          ).map(([f, l]) => (
            <Pill key={f} active={filtre === f} onClick={() => setFiltre(f)}>
              {l} <span className="opacity-60">· {compte(f)}</span>
            </Pill>
          ))}
        </div>
        {categories.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={!categorie} onClick={() => setCategorie(null)}>
              Toutes catégories
            </Pill>
            {categories.map(([c, n]) => (
              <Pill key={c} variant="cyan" active={categorie === c} onClick={() => setCategorie(c)}>
                {c} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (domaine, prestataire, parc…)"
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : liste.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">
          Aucun rapport. Dépose les comptes rendus dans l’onglet « Rapports prestataires » : ils sont analysés automatiquement.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupes.map(([c, rs]) => (
            <section key={c}>
              <h2 className="text-[13px] text-dim uppercase tracking-wider mb-2">
                {c} <span className="text-faint">· {rs.length}</span>
              </h2>
              <div className="flex flex-col gap-3">
                {rs.map((r) => (
                  <CarteAnalyse
                    key={r.id}
                    rapport={r}
                    selection={selection ? { cochee: selection.has(r.id), possible: aCorriger(r), basculer: () => basculer(r.id) } : null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CarteAnalyse({
  rapport: r,
  selection,
}: {
  rapport: RapportAnalyse;
  selection: { cochee: boolean; possible: boolean; basculer: () => void } | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [relance, setRelance] = useState(false);
  const a = analyseDe(r);
  const echeance = echeanceDe(r);
  const jours = echeance ? joursAvant(echeance) : null;
  const nonConformes = [...(a?.points_non_conformes ?? [])].sort((x, y) => ORDRE_GRAVITE[x.gravite] - ORDRE_GRAVITE[y.gravite]);
  const resultat = a?.resultat_global ? RESULTATS[a.resultat_global] : null;

  const relancer = async () => {
    setRelance(true);
    const { error } = await supabase.rpc('relancer_analyse_prestataire', { p_document_id: r.id });
    if (error) {
      toast.error(error.message);
      setRelance(false);
      return;
    }
    qc.invalidateQueries({ queryKey: ['analyses-prestataires'] });
    const { data, error: errFn } = await supabase.functions.invoke('analyser-rapport-prestataire', { body: { document_id: r.id } });
    setRelance(false);
    qc.invalidateQueries({ queryKey: ['analyses-prestataires'] });
    if (errFn || data?.success === false) toast.error(`Analyse impossible : ${data?.error ?? errFn?.message ?? ''}`);
    else toast.success('Analyse terminée');
  };

  const ouvrirRapport = async () => {
    const fenetre = window.open('', '_blank');
    try {
      let lien: string;
      if (r.parties) {
        lien = URL.createObjectURL(await recollerDocument('alba-techniques', r.chemin, r.parties, r.mime));
      } else {
        const { data, error } = await supabase.storage.from('alba-techniques').createSignedUrl(r.chemin, 3600);
        if (error || !data) throw error ?? new Error('Lien indisponible');
        lien = data.signedUrl;
      }
      if (fenetre) fenetre.location.href = lien;
      else window.open(lien, '_blank');
    } catch (e) {
      fenetre?.close();
      toast.error((e as Error).message);
    }
  };

  return (
    <div className={cn('bg-bg-card rounded-xl border', selection?.cochee ? 'border-nikito-cyan/60' : 'border-white/[0.06]')}>
      <div className="flex">
        {selection && (
          <label
            className={cn('flex items-start pt-4 pl-4 pr-1 min-w-[44px]', selection.possible ? 'cursor-pointer' : 'opacity-30')}
            title={selection.possible ? 'Inclure dans le mail' : 'Aucun point à corriger'}
          >
            <input
              type="checkbox"
              checked={selection.cochee}
              disabled={!selection.possible}
              onChange={selection.basculer}
              className="w-5 h-5 accent-nikito-cyan"
              aria-label={`Inclure ${r.titre} dans le mail`}
            />
          </label>
        )}
        <button onClick={() => setOuvert((o) => !o)} className="flex-1 min-w-0 text-left p-3.5 px-4 flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold truncate">{[r.activite, r.prestataire].filter(Boolean).join(' · ') || r.titre}</div>
            <div className="text-[12px] text-dim mt-0.5">
              {[r.parc?.code ?? 'Tous parcs', r.date_document ? `contrôle du ${new Date(r.date_document).toLocaleDateString('fr-FR')}` : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
            {a?.statut === 'terminee' && a.resume && <div className="text-[12px] text-faint mt-1 line-clamp-2">{a.resume}</div>}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {a?.statut === 'terminee' && resultat ? (
              <span className={cn('text-[10px] px-2 py-0.5 rounded', resultat.classe)}>{resultat.label}</span>
            ) : a?.statut === 'echec' ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red/15 text-red">Analyse échouée</span>
            ) : a ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-nikito-cyan/15 text-nikito-cyan animate-pulse">Analyse en cours…</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-dim">Non analysé</span>
            )}
            {nonConformes.length > 0 && <span className="text-[11px] text-red">❌ {nonConformes.length} à corriger</span>}
            {echeance && jours !== null && (
              <span className={cn('text-[11px]', jours < 0 ? 'text-red' : jours <= 30 ? 'text-amber' : 'text-dim')}>
                {jours < 0 ? `Renouvellement dépassé de ${-jours} j` : `Renouveler avant le ${new Date(echeance).toLocaleDateString('fr-FR')}`}
              </span>
            )}
          </div>
        </button>
      </div>

      {ouvert && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 grid gap-3 text-[13px]">
          {a?.statut === 'echec' && <div className="text-red text-[12px] bg-red/10 rounded-lg p-2.5">{a.erreur}</div>}
          {a?.statut === 'terminee' && (
            <>
              {a.resume && <div className="whitespace-pre-line">{a.resume}</div>}
              {nonConformes.length > 0 && (
                <div>
                  <div className="text-[11px] text-red uppercase tracking-wider mb-1.5">Points non conformes · {nonConformes.length}</div>
                  <ul className="grid gap-2">
                    {nonConformes.map((p, i) => (
                      <li key={i} className="bg-red/[0.06] border border-red/20 rounded-lg p-2.5">
                        <div className="font-medium">
                          ❌ {p.intitule} <span className={cn('text-[11px] font-normal', GRAVITES[p.gravite])}>· {p.gravite}</span>
                        </div>
                        {p.detail && <div className="text-[12px] text-dim mt-0.5">{p.detail}</div>}
                        {p.action && <div className="text-[12px] text-text mt-1">➜ {p.action}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {a.points_conformes.length > 0 && (
                <div>
                  <div className="text-[11px] text-green uppercase tracking-wider mb-1.5">Points conformes · {a.points_conformes.length}</div>
                  <ul className="grid gap-1">
                    {a.points_conformes.map((p, i) => (
                      <li key={i}>
                        ✅ {p.intitule}
                        {p.detail && <span className="text-dim text-[12px]"> — {p.detail}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-[12px] text-dim">
                {[
                  a.date_controle ? `Contrôle du ${new Date(a.date_controle).toLocaleDateString('fr-FR')}` : null,
                  a.periodicite ? `Périodicité : ${a.periodicite}` : null,
                  echeance ? `Prochain contrôle : ${new Date(echeance).toLocaleDateString('fr-FR')}` : 'Prochain contrôle non trouvé dans le rapport',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="text-[11px] text-faint">Analyse automatique : à vérifier sur le rapport original en cas de doute.</div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={ouvrirRapport} className="bg-nikito-cyan/15 text-nikito-cyan border border-nikito-cyan/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]">
              Ouvrir le rapport
            </button>
            <button
              onClick={relancer}
              disabled={relance || a?.statut === 'en_cours'}
              className={cn('bg-bg-deep border border-white/[0.08] px-4 rounded-[10px] text-[13px] min-h-[44px]', (relance || a?.statut === 'en_cours') && 'opacity-40')}
            >
              {relance ? 'Analyse…' : a ? 'Relancer l’analyse' : 'Analyser'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Demande d'intervention rédigée à partir des points non conformes des rapports cochés. */
function ModaleMailReparation({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const toast = useToast();
  const [precision, setPrecision] = useState('');
  const [destinataire, setDestinataire] = useState('');
  const [objet, setObjet] = useState('');
  const [corps, setCorps] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const rediger = async () => {
    setEnCours(true);
    setErreur(null);
    const { data, error } = await supabase.functions.invoke('rediger-mail-reparation', {
      body: { document_ids: ids, precision: precision.trim() || undefined },
    });
    setEnCours(false);
    if (error || data?.success === false) {
      setErreur(data?.error ?? error?.message ?? 'Rédaction impossible');
      return;
    }
    setObjet(data.objet ?? '');
    setCorps(data.corps ?? '');
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(`Objet : ${objet}\n\n${corps}`);
      toast.success('Mail copié');
    } catch {
      toast.error('Copie impossible : sélectionne le texte à la main');
    }
  };

  const lienMail = `mailto:${encodeURIComponent(destinataire.trim())}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
  const champ = 'mt-1 w-full bg-bg-deep border border-white/[0.08] rounded-[10px] text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50';

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[680px] max-h-[92dvh] overflow-y-auto bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3"
      >
        <div>
          <div className="text-[16px] font-semibold">Mail de réparation</div>
          <div className="text-[12px] text-dim">
            {ids.length} rapport{ids.length > 1 ? 's' : ''} sélectionné{ids.length > 1 ? 's' : ''} : les points non conformes sont regroupés
            (doublons fusionnés) dans une demande d’intervention.
          </div>
        </div>

        {!corps ? (
          <>
            <label className="text-[12px] text-dim">
              Précision pour la rédaction (facultatif)
              <textarea
                value={precision}
                onChange={(e) => setPrecision(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Ex. : adressé à l’électricien Dupont, intervention souhaitée avant le 15/11, accès au parc avant 10 h…"
                className={cn(champ, 'p-3')}
              />
            </label>
            {erreur && <div className="text-red text-[12px] bg-red/10 rounded-lg p-2.5">{erreur}</div>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim">
                Annuler
              </button>
              <button
                onClick={rediger}
                disabled={enCours}
                className={cn('bg-nikito-cyan text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[44px]', enCours && 'opacity-60 animate-pulse')}
              >
                {enCours ? 'Rédaction en cours…' : 'Rédiger le mail'}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="text-[12px] text-dim">
              Destinataire (facultatif)
              <input
                type="email"
                value={destinataire}
                onChange={(e) => setDestinataire(e.target.value)}
                placeholder="adresse@entreprise.fr"
                className={cn(champ, 'px-3 py-2.5 min-h-[44px]')}
              />
            </label>
            <label className="text-[12px] text-dim">
              Objet
              <input value={objet} onChange={(e) => setObjet(e.target.value)} className={cn(champ, 'px-3 py-2.5 min-h-[44px]')} />
            </label>
            <label className="text-[12px] text-dim">
              Message (modifiable)
              <textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={16} className={cn(champ, 'p-3 leading-relaxed')} />
            </label>
            <div className="text-[11px] text-faint">Rédaction automatique : relis le mail avant de l’envoyer.</div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => {
                  setCorps('');
                  setObjet('');
                }}
                className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim"
              >
                Refaire
              </button>
              <button
                onClick={copier}
                className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-nikito-cyan/15 text-nikito-cyan border border-nikito-cyan/40 font-semibold"
              >
                Copier
              </button>
              <a href={lienMail} className="bg-nikito-cyan text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] flex items-center">
                Ouvrir dans ma messagerie
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
