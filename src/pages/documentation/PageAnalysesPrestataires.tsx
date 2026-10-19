import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import { envoyerFichier, recollerDocument } from '@/lib/envoiGrosFichier';
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
interface Levee {
  id: string;
  point_intitule: string;
  statut: 'levee' | 'annulee';
  justification: string | null;
  attestation_chemin: string | null;
  attestation_nom: string | null;
  leve_par_nom: string | null;
  leve_le: string;
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
  levees: Levee[] | null;
}

const RESULTATS: Record<string, { label: string; classe: string }> = {
  conforme: { label: 'Conforme', classe: 'bg-green/15 text-green' },
  conforme_avec_reserves: { label: 'Conforme avec réserves', classe: 'bg-amber/15 text-amber' },
  non_conforme: { label: 'Non conforme', classe: 'bg-red/15 text-red' },
  indetermine: { label: 'Indéterminé', classe: 'bg-white/[0.06] text-dim' },
};
const GRAVITES: Record<string, string> = { bloquante: 'text-red', majeure: 'text-amber', mineure: 'text-dim' };
const ORDRE_GRAVITE: Record<string, number> = { bloquante: 0, majeure: 1, mineure: 2 };

const TOUS_PARCS = 'Tous les parcs';
// Parcs dans l'ordre des codes, « Tous les parcs » en dernier ; domaines alphabétiques, « À classer » en dernier
const trierParcs = (a: string, b: string) => (a === TOUS_PARCS ? 1 : b === TOUS_PARCS ? -1 : a.localeCompare(b, 'fr'));
const trierCategories = (a: string, b: string) => (a === 'À classer' ? 1 : b === 'À classer' ? -1 : a.localeCompare(b, 'fr'));

/** Groupes distincts (avec leur nombre d'éléments), triés. */
function compter<T>(elements: T[], cle: (e: T) => string, trier: (a: string, b: string) => number): [string, number][] {
  const m = new Map<string, number>();
  elements.forEach((e) => m.set(cle(e), (m.get(cle(e)) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => trier(a[0], b[0]));
}

type Filtre = 'tous' | 'a_corriger' | 'a_renouveler' | 'conformes';

const analyseDe = (r: RapportAnalyse): Analyse | null => (Array.isArray(r.analyse) ? r.analyse[0] ?? null : r.analyse);
const echeanceDe = (r: RapportAnalyse) => r.prochaine_echeance ?? analyseDe(r)?.prochaine_echeance ?? null;
// Défaut levé (attestation / compte rendu déposé)
const leveeDe = (r: RapportAnalyse, intitule: string) =>
  (r.levees ?? []).find((l) => l.statut === 'levee' && l.point_intitule.trim() === intitule.trim()) ?? null;
const defautsOuverts = (r: RapportAnalyse) => (analyseDe(r)?.points_non_conformes ?? []).filter((p) => !leveeDe(r, p.intitule));
const joursAvant = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

function useAnalyses() {
  return useQuery({
    queryKey: ['analyses-prestataires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents_techniques')
        .select(
          `id, titre, activite, prestataire, chemin, mime, parties, date_document, prochaine_echeance, cree_le,
          parc:parcs(code, nom), analyse:analyses_rapports_prestataires(*),
          levees:levees_defauts_prestataires(id, point_intitule, statut, justification, attestation_chemin, attestation_nom, leve_par_nom, leve_le)`
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
  const [parc, setParc] = useState<string | null>(null);
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
  const parcDe = (r: RapportAnalyse) => (r.parc ? `${r.parc.code} · ${r.parc.nom}` : TOUS_PARCS);

  const aCorriger = (r: RapportAnalyse) => defautsOuverts(r).length > 0;
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
      .filter((r) => !parc || parcDe(r) === parc)
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
  }, [rapports, filtre, recherche, categorie, parc]);

  const parcs = useMemo(() => compter(rapports ?? [], parcDe, trierParcs), [rapports]);
  // Catégories (domaines) créées au fil des analyses, dans le parc choisi
  const categories = useMemo(
    () => compter((rapports ?? []).filter((r) => !parc || parcDe(r) === parc), categorieDe, trierCategories),
    [rapports, parc]
  );
  // Rangement : parc, puis domaine
  const groupes = useMemo(
    () =>
      compter(liste, parcDe, trierParcs).map(([p, total]) => {
        const duParc = liste.filter((r) => parcDe(r) === p);
        const domaines: [string, RapportAnalyse[]][] = compter(duParc, categorieDe, trierCategories).map(([c]) => [
          c,
          duParc.filter((r) => categorieDe(r) === c),
        ]);
        return { p, total, domaines };
      }),
    [liste]
  );

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
        {parcs.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={!parc} onClick={() => setParc(null)}>
              Tous les parcs
            </Pill>
            {parcs.map(([p, n]) => (
              <Pill key={p} variant="cyan" active={parc === p} onClick={() => setParc(p)}>
                {p} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
        {categories.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={!categorie} onClick={() => setCategorie(null)}>
              Tous domaines
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
          {groupes.map(({ p, total, domaines }) => (
            <section key={p}>
              <h2 className="text-[13px] text-dim uppercase tracking-wider mb-2">
                {p} <span className="text-faint">· {total}</span>
              </h2>
              <div className="flex flex-col gap-4 pl-3 border-l border-white/[0.06]">
                {domaines.map(([c, rs]) => (
                  <div key={c}>
                    <h3 className="text-[12px] text-nikito-cyan font-semibold mb-2">
                      {c} <span className="text-faint font-normal">· {rs.length}</span>
                    </h3>
                    <div className="flex flex-col gap-3">
                      {rs.map((r) => (
                        <CarteAnalyse
                          key={r.id}
                          rapport={r}
                          selection={selection ? { cochee: selection.has(r.id), possible: aCorriger(r), basculer: () => basculer(r.id) } : null}
                        />
                      ))}
                    </div>
                  </div>
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
  const [leverOuvert, setLeverOuvert] = useState(false);
  const a = analyseDe(r);
  const ouverts = defautsOuverts(r);
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

  const ouvrirAttestation = async (chemin: string) => {
    const fenetre = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('alba-techniques').createSignedUrl(chemin, 3600);
    if (error || !data) {
      fenetre?.close();
      toast.error(error?.message ?? 'Lien indisponible');
      return;
    }
    if (fenetre) fenetre.location.href = data.signedUrl;
    else window.open(data.signedUrl, '_blank');
  };

  const annulerLevee = async (l: Levee) => {
    if (!window.confirm(`Remettre « ${l.point_intitule} » en défaut à corriger ?`)) return;
    const { error } = await supabase.rpc('annuler_levee_defaut', { p_levee_id: l.id });
    if (error) toast.error(error.message);
    else {
      toast.info('Défaut remis à corriger');
      qc.invalidateQueries({ queryKey: ['analyses-prestataires'] });
    }
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
            {ouverts.length > 0 ? (
              <span className="text-[11px] text-red">❌ {ouverts.length} à corriger</span>
            ) : (
              nonConformes.length > 0 && <span className="text-[11px] text-green">✅ Défauts levés</span>
            )}
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
                  <div className="text-[11px] text-red uppercase tracking-wider mb-1.5">
                    Points non conformes · {nonConformes.length}
                    {ouverts.length < nonConformes.length && <span className="text-green"> · {nonConformes.length - ouverts.length} levé(s)</span>}
                  </div>
                  <ul className="grid gap-2">
                    {nonConformes.map((p, i) => {
                      const levee = leveeDe(r, p.intitule);
                      return (
                        <li
                          key={i}
                          className={cn('rounded-lg p-2.5 border', levee ? 'bg-green/[0.06] border-green/20' : 'bg-red/[0.06] border-red/20')}
                        >
                          <div className={cn('font-medium', levee && 'text-dim')}>
                            {levee ? '✅' : '❌'} {p.intitule}{' '}
                            <span className={cn('text-[11px] font-normal', levee ? 'text-green' : GRAVITES[p.gravite])}>
                              · {levee ? 'levé' : p.gravite}
                            </span>
                          </div>
                          {p.detail && <div className="text-[12px] text-dim mt-0.5">{p.detail}</div>}
                          {levee ? (
                            <div className="text-[12px] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="text-green">
                                Levé le {new Date(levee.leve_le).toLocaleDateString('fr-FR')}
                                {levee.leve_par_nom ? ` par ${levee.leve_par_nom}` : ''}
                                {levee.justification ? ` — ${levee.justification}` : ''}
                              </span>
                              {levee.attestation_chemin && (
                                <button onClick={() => ouvrirAttestation(levee.attestation_chemin!)} className="text-nikito-cyan font-semibold min-h-[32px]">
                                  📎 {levee.attestation_nom || 'Attestation'}
                                </button>
                              )}
                              <button onClick={() => annulerLevee(levee)} className="text-dim underline min-h-[32px]">
                                Annuler
                              </button>
                            </div>
                          ) : (
                            p.action && <div className="text-[12px] text-text mt-1">➜ {p.action}</div>
                          )}
                        </li>
                      );
                    })}
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
            {a?.statut === 'terminee' && ouverts.length > 0 && (
              <button
                onClick={() => setLeverOuvert(true)}
                className="bg-green/15 text-green border border-green/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
              >
                📎 Lever les défauts
              </button>
            )}
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
      {leverOuvert && <ModaleLeverDefauts rapport={r} defauts={ouverts} onClose={() => setLeverOuvert(false)} />}
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

const TAILLE_MAX_ATTESTATION = 22 * 1024 * 1024;

/**
 * Levée des défauts : dépôt de l'attestation / du compte rendu d'intervention,
 * lecture automatique (défauts levés proposés), puis confirmation.
 */
function ModaleLeverDefauts({ rapport: r, defauts, onClose }: { rapport: RapportAnalyse; defauts: PointNonConforme[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fichier, setFichier] = useState<File | null>(null);
  const [envoye, setEnvoye] = useState<{ chemin: string; nom: string; mime: string } | null>(null);
  const [etape, setEtape] = useState<'fichier' | 'lecture' | 'choix' | 'enregistrement'>('fichier');
  const [resume, setResume] = useState<string | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [propositions, setPropositions] = useState<Record<string, string>>({});
  const [coches, setCoches] = useState<Set<string>>(new Set());

  const envoyerEtLire = async () => {
    if (!fichier) return;
    if (fichier.size > TAILLE_MAX_ATTESTATION) {
      toast.error('Fichier trop lourd (22 Mo maximum)');
      return;
    }
    setEtape('lecture');
    let depot = envoye;
    try {
      if (!depot) {
        const nomPropre = fichier.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
        const chemin = `prestataire/${r.parc?.code ?? 'commun'}/attestations/${Date.now()}_${nomPropre}`;
        await envoyerFichier('alba-techniques', chemin, fichier);
        depot = { chemin, nom: fichier.name.slice(0, 200), mime: fichier.type || 'application/pdf' };
        setEnvoye(depot);
      }
    } catch (e) {
      toast.error((e as Error).message);
      setEtape('fichier');
      return;
    }
    const { data, error } = await supabase.functions.invoke('analyser-attestation-levee', {
      body: { document_id: r.id, chemin: depot.chemin, mime: depot.mime },
    });
    if (error || data?.success === false) {
      // La lecture a échoué : le choix reste possible à la main
      setErreurLecture(data?.error ?? error?.message ?? 'Lecture impossible');
    } else {
      const pts = (data.points ?? []) as { intitule: string; levee: boolean; justification: string }[];
      setResume(data.resume ?? null);
      setPropositions(Object.fromEntries(pts.map((p) => [p.intitule, p.justification])));
      setCoches(new Set(pts.filter((p) => p.levee).map((p) => p.intitule)));
    }
    setEtape('choix');
  };

  const basculer = (intitule: string) =>
    setCoches((c) => {
      const n = new Set(c);
      if (n.has(intitule)) n.delete(intitule);
      else n.add(intitule);
      return n;
    });

  const confirmer = async () => {
    if (!envoye || coches.size === 0) return;
    setEtape('enregistrement');
    const points = defauts
      .filter((d) => coches.has(d.intitule))
      .map((d) => ({
        intitule: d.intitule,
        justification: propositions[d.intitule] && !erreurLecture ? propositions[d.intitule] : 'Levé au vu du document déposé',
      }));
    const { error } = await supabase.rpc('lever_defauts_prestataire', {
      p_document_id: r.id,
      p_points: points,
      p_attestation_chemin: envoye.chemin,
      p_attestation_nom: envoye.nom,
      p_attestation_mime: envoye.mime,
    });
    if (error) {
      toast.error(error.message);
      setEtape('choix');
      return;
    }
    toast.success(`${points.length} défaut${points.length > 1 ? 's levés' : ' levé'}`);
    qc.invalidateQueries({ queryKey: ['analyses-prestataires'] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[620px] max-h-[92dvh] overflow-y-auto bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-green/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3 text-[13px]"
      >
        <div>
          <div className="text-[16px] font-semibold">Lever les défauts</div>
          <div className="text-[12px] text-dim">
            {[r.activite, r.prestataire, r.parc?.code].filter(Boolean).join(' · ')} — {defauts.length} défaut{defauts.length > 1 ? 's' : ''} à lever
          </div>
        </div>

        {etape === 'fichier' || etape === 'lecture' ? (
          <>
            <label className="text-[12px] text-dim">
              Attestation ou compte rendu d’intervention détaillé (PDF ou photo)
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={etape === 'lecture'}
                onChange={(e) => {
                  setFichier(e.target.files?.[0] ?? null);
                  setEnvoye(null);
                }}
                className="mt-1 block w-full text-[13px] text-text file:mr-3 file:rounded-[10px] file:border-0 file:bg-green/15 file:text-green file:px-4 file:py-2.5 file:font-semibold"
              />
            </label>
            <div className="text-[12px] text-faint">
              Le document est lu automatiquement : les défauts qu’il corrige sont cochés, tu valides ensuite.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim">
                Annuler
              </button>
              <button
                onClick={envoyerEtLire}
                disabled={!fichier || etape === 'lecture'}
                className={cn(
                  'bg-green text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[44px]',
                  !fichier && 'opacity-40',
                  etape === 'lecture' && 'opacity-60 animate-pulse'
                )}
              >
                {etape === 'lecture' ? 'Lecture du document…' : 'Envoyer et lire'}
              </button>
            </div>
          </>
        ) : (
          <>
            {resume && <div className="bg-bg-deep rounded-lg p-2.5 text-[12px]">{resume}</div>}
            {erreurLecture && (
              <div className="text-amber text-[12px] bg-amber/10 rounded-lg p-2.5">
                Lecture automatique impossible ({erreurLecture}). Coche à la main les défauts corrigés par ce document.
              </div>
            )}
            <ul className="grid gap-2">
              {defauts.map((d) => (
                <li key={d.intitule}>
                  <label
                    className={cn(
                      'flex gap-3 items-start rounded-lg p-2.5 border cursor-pointer',
                      coches.has(d.intitule) ? 'bg-green/[0.06] border-green/30' : 'bg-bg-deep border-white/[0.06]'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={coches.has(d.intitule)}
                      onChange={() => basculer(d.intitule)}
                      className="w-5 h-5 mt-0.5 accent-green flex-shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{d.intitule}</span>{' '}
                      <span className={cn('text-[11px]', GRAVITES[d.gravite])}>· {d.gravite}</span>
                      {propositions[d.intitule] && <span className="block text-[12px] text-dim mt-0.5">{propositions[d.intitule]}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="text-[11px] text-faint">Lecture automatique : vérifie avant de confirmer. Une levée peut être annulée ensuite.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim">
                Annuler
              </button>
              <button
                onClick={confirmer}
                disabled={coches.size === 0 || etape === 'enregistrement'}
                className={cn(
                  'bg-green text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[44px]',
                  (coches.size === 0 || etape === 'enregistrement') && 'opacity-40'
                )}
              >
                {etape === 'enregistrement' ? 'Enregistrement…' : `Lever ${coches.size} défaut${coches.size > 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
