import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAccesCommandes } from '@/hooks/queries/useCommandes';
import { peutEntrerStock, peutVoirStock } from '@/lib/acces';
import { ModaleImportFacture } from './ModaleImportFacture';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFournisseurs, useParcs } from '@/hooks/queries/useReferentiel';
import { useFormationFilter } from '@/hooks/useFormation';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { chargerToutesLesPages } from '@/lib/paginer';
import { useToast } from '@/components/ui/ToastProvider';
import { ChampQuantite } from '@/components/ui/ChampQuantite';
import { SignalerInlineButton } from '@/components/shared/SignalerInlineButton';
import type { PieceDetacheeAvecJoins } from '@/types/database';

type FiltreCritique = 'tous' | 'critique' | 'ok';

function usePiecesDetachees() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['pieces_detachees', estFormation],
    queryFn: () =>
      chargerToutesLesPages<PieceDetacheeAvecJoins>((debut, fin) =>
        supabase
          .from('pieces_detachees')
          .select('*, fournisseurs(nom, contact_tel), parc:parcs(code, nom), activite:commande_activites(nom)')
          .eq('est_formation', estFormation)
          .order('nom')
          .order('id')
          .range(debut, fin)
      ),
  });
}

/** Domaines de rangement : activités du catalogue de commandes. */
function useDomaines() {
  return useQuery({
    queryKey: ['commande_activites', 'domaines'],
    queryFn: async () => {
      const { data, error } = await supabase.from('commande_activites').select('id, nom').eq('actif', true).order('ordre').order('nom');
      if (error) throw error;
      return (data ?? []) as { id: string; nom: string }[];
    },
    staleTime: 5 * 60_000,
  });
}

function useRangerPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...champs }: { id: string; parc_id: string | null; activite_id: string | null; emplacement: string | null }) => {
      const { error } = await supabase.from('pieces_detachees').update(champs).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces_detachees'] });
    },
  });
}

const TOUS_PARCS = 'Stock commun (tous parcs)';
const A_CLASSER = 'À classer';
const parcDe = (p: PieceDetacheeAvecJoins) => (p.parc ? `${p.parc.code} · ${p.parc.nom}` : TOUS_PARCS);
const domaineDe = (p: PieceDetacheeAvecJoins) => p.activite?.nom ?? A_CLASSER;
// Parcs dans l'ordre des codes, stock commun en dernier ; domaines alphabétiques, « À classer » en dernier
const trierParcs = (a: string, b: string) => (a === TOUS_PARCS ? 1 : b === TOUS_PARCS ? -1 : a.localeCompare(b, 'fr'));
const trierDomaines = (a: string, b: string) => (a === A_CLASSER ? 1 : b === A_CLASSER ? -1 : a.localeCompare(b, 'fr'));

/** Groupes distincts (avec leur nombre d'éléments), triés. */
function compter<T>(elements: T[], cle: (e: T) => string, trier: (a: string, b: string) => number): [string, number][] {
  const m = new Map<string, number>();
  elements.forEach((e) => m.set(cle(e), (m.get(cle(e)) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => trier(a[0], b[0]));
}

function useModifierStock() {
  const qc = useQueryClient();
  return useMutation({
    // Mouvement appliqué en une requête côté base (pas de lecture puis réécriture
    // qui écraserait une livraison ou une clôture d'intervention simultanée)
    // Entrée avec parc choisi (parcId défini, vide = stock commun) : entree_stock_parc
    mutationFn: async ({ id, delta, parcId }: { id: string; delta: number; parcId?: string }) => {
      const { error } =
        delta > 0 && parcId !== undefined
          ? await supabase.rpc('entree_stock_parc', { p_piece_id: id, p_parc_id: parcId || null, p_quantite: delta })
          : await supabase.rpc('mouvement_stock', { p_piece_id: id, p_delta: delta });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces_detachees'] });
    },
  });
}

function useCreerPiece() {
  const qc = useQueryClient();
  const { estFormation } = useFormationFilter();
  return useMutation({
    mutationFn: async (payload: {
      reference: string;
      nom: string;
      description?: string | null;
      fournisseur_id?: string | null;
      stock_actuel?: number;
      stock_min?: number;
      prix_unitaire_ht?: number | null;
      emplacement?: string | null;
      parc_id?: string | null;
      activite_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('pieces_detachees')
        .insert({ ...payload, est_formation: estFormation })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces_detachees'] });
    },
  });
}

export function PageStock() {
  const { utilisateur } = useAuth();
  const { estGestionnaire, isLoading } = useAccesCommandes();
  if (isLoading) return null;
  if (!peutVoirStock(utilisateur?.role_code, estGestionnaire)) return <Navigate to="/" replace />;
  return <ContenuStock />;
}

function ContenuStock() {
  const { utilisateur } = useAuth();
  const toast = useToast();
  const { estGestionnaire } = useAccesCommandes();
  // Sorties : tout le monde ; entrées et nouvelles pièces : chef d'équipe / gestionnaires
  const peutSortir = peutVoirStock(utilisateur?.role_code, estGestionnaire);
  const peutEntrer = peutEntrerStock(utilisateur?.role_code, estGestionnaire);
  const { data: pieces, isLoading } = usePiecesDetachees();
  const { data: fournisseurs } = useFournisseurs();
  const modStock = useModifierStock();

  const [recherche, setRecherche] = useState('');
  const [importFacture, setImportFacture] = useState(false);
  const [fournisseurFilter, setFournisseurFilter] = useState('');
  const [filtreCrit, setFiltreCrit] = useState<FiltreCritique>('tous');
  const [modaleCreer, setModaleCreer] = useState(false);
  const [mouvementPiece, setMouvementPiece] = useState<{ id: string; nom: string; type: 'entree' | 'sortie' } | null>(null);
  // Entrée de stock : parc qui reçoit les pièces (vide = stock commun)
  const [parcEntree, setParcEntree] = useState('');
  const [mouvementQty, setMouvementQty] = useState(1);
  const [parcFiltre, setParcFiltre] = useState<string | null>(null);
  const [domaineFiltre, setDomaineFiltre] = useState<string | null>(null);
  const [pieceARanger, setPieceARanger] = useState<PieceDetacheeAvecJoins | null>(null);

  const filtrees = useMemo(() => {
    let result = pieces ?? [];
    if (filtreCrit === 'critique') result = result.filter((p) => p.stock_actuel < p.stock_min);
    if (filtreCrit === 'ok') result = result.filter((p) => p.stock_actuel >= p.stock_min);
    if (fournisseurFilter) result = result.filter((p) => p.fournisseur_id === fournisseurFilter);
    if (parcFiltre) result = result.filter((p) => parcDe(p) === parcFiltre);
    if (domaineFiltre) result = result.filter((p) => domaineDe(p) === domaineFiltre);
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter((p) =>
        [p.reference, p.nom, p.emplacement].filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }
    return result;
  }, [pieces, filtreCrit, fournisseurFilter, recherche, parcFiltre, domaineFiltre]);

  // Rangement : parc, puis domaine
  const parcsDispo = useMemo(() => compter(pieces ?? [], parcDe, trierParcs), [pieces]);
  // Choix du parc toujours proposé : tous les parcs de l'utilisateur + stock commun
  const { data: parcsListe } = useParcs();
  const parcsChoix = useMemo(() => {
    const nb = new Map(parcsDispo);
    const liste = ((parcsListe ?? []) as { id: string; code: string; nom: string }[]).map((p) => {
      const label = `${p.code} · ${p.nom}`;
      return { id: p.id, label, n: nb.get(label) ?? 0 };
    });
    return [...liste, { id: '', label: TOUS_PARCS, n: nb.get(TOUS_PARCS) ?? 0 }];
  }, [parcsListe, parcsDispo]);
  const parcIdChoisi = parcsChoix.find((p) => p.label === parcFiltre)?.id ?? '';
  const domainesDispo = useMemo(
    () => compter((pieces ?? []).filter((p) => !parcFiltre || parcDe(p) === parcFiltre), domaineDe, trierDomaines),
    [pieces, parcFiltre]
  );
  const groupes = useMemo(
    () =>
      compter(filtrees, parcDe, trierParcs).map(([parc, total]) => {
        const duParc = filtrees.filter((p) => parcDe(p) === parc);
        const domaines: [string, PieceDetacheeAvecJoins[]][] = compter(duParc, domaineDe, trierDomaines).map(([d]) => [
          d,
          duParc.filter((p) => domaineDe(p) === d),
        ]);
        return { parc, total, domaines };
      }),
    [filtrees]
  );

  const kpis = useMemo(() => {
    const all = pieces ?? [];
    const critique = all.filter((p) => p.stock_actuel < p.stock_min).length;
    const valeurTotale = all.reduce((sum, p) => sum + (p.prix_unitaire_ht ?? 0) * p.stock_actuel, 0);
    return { total: all.length, critique, valeurTotale };
  }, [pieces]);

  const submitMouvement = async () => {
    if (!mouvementPiece) return;
    const delta = mouvementPiece.type === 'entree' ? mouvementQty : -mouvementQty;
    try {
      await modStock.mutateAsync({ id: mouvementPiece.id, delta, parcId: mouvementPiece.type === 'entree' ? parcEntree : undefined });
      const parcLabel =
        mouvementPiece.type === 'entree'
          ? ` · ${parcsChoix.find((c) => c.id === parcEntree)?.label ?? 'stock commun'}`
          : '';
      toast.success(`${mouvementPiece.nom} : ${delta > 0 ? '+' : ''}${delta}${parcLabel}`);
      setMouvementPiece(null);
      setMouvementQty(1);
    } catch {
      // erreur affichée dans la modale (modStock.isError)
    }
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Stock pieces detachees</h1>
          <p className="text-[13px] text-dim mt-1">
            {kpis.total} references &middot;{' '}
            <span className="text-red font-medium">{kpis.critique} en rupture</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {peutEntrer && (
            <button
              onClick={() => setImportFacture(true)}
              className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-4 py-2.5 rounded-[10px] text-[13px] font-semibold min-h-[44px] w-full sm:w-auto"
            >
              📄 Importer une facture
            </button>
          )}
          {peutEntrer && (
            <button
              onClick={() => setModaleCreer(true)}
              className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center"
            >
              <span className="text-base leading-none">+</span> Nouvelle piece
            </button>
          )}
          <div className="hidden md:flex items-center gap-2 ml-1">
            <div className="h-8 w-px bg-white/[0.08]" />
            <SignalerInlineButton />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <Compteur label="Total" value={String(kpis.total)} />
        <Compteur label="Stock critique" value={String(kpis.critique)} color="red" />
        <Compteur label="Valeur totale" value={`${kpis.valeurTotale.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR`} />
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (reference, nom, emplacement)..."
            className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
          <select
            value={fournisseurFilter}
            onChange={(e) => setFournisseurFilter(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[200px]"
          >
            <option value="">Tous les fournisseurs</option>
            {fournisseurs?.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          {(['tous', 'critique', 'ok'] as FiltreCritique[]).map((v) => (
            <Pill key={v} active={filtreCrit === v} variant="cyan" onClick={() => setFiltreCrit(v)} className="min-h-[36px]">
              {v === 'tous' ? 'Tous' : v === 'critique' ? 'Stock critique' : 'Stock OK'}
            </Pill>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Pill variant="cyan" active={!parcFiltre} onClick={() => setParcFiltre(null)} className="min-h-[36px]">
            Tous les parcs <span className="opacity-60">· {(pieces ?? []).length}</span>
          </Pill>
          {parcsChoix.map((p) => (
            <Pill key={p.label} variant="cyan" active={parcFiltre === p.label} onClick={() => setParcFiltre(p.label)} className="min-h-[36px]">
              {p.label} <span className="opacity-60">· {p.n}</span>
            </Pill>
          ))}
        </div>
        {domainesDispo.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill active={!domaineFiltre} onClick={() => setDomaineFiltre(null)} className="min-h-[36px]">
              Tous domaines
            </Pill>
            {domainesDispo.map(([g, n]) => (
              <Pill key={g} active={domaineFiltre === g} onClick={() => setDomaineFiltre(g)} className="min-h-[36px]">
                {g} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : filtrees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm">Aucune piece trouvee.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupes.map(({ parc, total, domaines }) => (
            <section key={parc}>
              <h2 className="text-[13px] text-dim uppercase tracking-wider mb-2">
                {parc} <span className="text-faint">· {total}</span>
              </h2>
              <div className="flex flex-col gap-4 md:pl-3 md:border-l border-white/[0.06]">
                {domaines.map(([domaine, liste]) => (
                  <div key={domaine}>
                    <h3 className="text-[12px] text-nikito-cyan font-semibold mb-1">
                      {domaine} <span className="text-faint font-normal">· {liste.length}</span>
                    </h3>
                  <div className="overflow-x-auto -mx-4 md:mx-0">
                    <table className="w-full min-w-[700px] text-[13px]">
                      <thead>
                        <tr className="text-[10px] text-dim uppercase tracking-wider border-b border-white/[0.06]">
                          <th className="text-left py-2.5 px-4 font-medium">Reference</th>
                          <th className="text-left py-2.5 px-3 font-medium">Nom</th>
                          <th className="text-left py-2.5 px-3 font-medium">Fournisseur</th>
                          <th className="text-right py-2.5 px-3 font-medium">Stock</th>
                          <th className="text-right py-2.5 px-3 font-medium">Seuil</th>
                          <th className="text-right py-2.5 px-3 font-medium">Prix HT</th>
                          <th className="text-left py-2.5 px-3 font-medium">Emplacement</th>
                          <th className="text-right py-2.5 px-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liste.map((p) => {
                          const critique = p.stock_actuel < p.stock_min;
                          return (
                            <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-mono text-nikito-cyan">{p.reference}</td>
                              <td className="py-3 px-3">{p.nom}</td>
                              <td className="py-3 px-3 text-dim">{p.fournisseurs?.nom ?? '—'}</td>
                              <td className="py-3 px-3 text-right">
                                <span className={cn('font-semibold', critique ? 'text-red' : 'text-text')}>
                                  {p.stock_actuel}
                                </span>
                                {critique && (
                                  <span className="ml-1.5 text-[10px] bg-red/15 text-red px-1.5 py-0.5 rounded">
                                    Critique
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right text-dim">{p.stock_min}</td>
                              <td className="py-3 px-3 text-right text-dim">
                                {p.prix_unitaire_ht != null ? `${Number(p.prix_unitaire_ht).toFixed(2)} EUR` : '—'}
                              </td>
                              <td className="py-3 px-3 text-dim">{p.emplacement ?? '—'}</td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                {peutSortir ? (
                                  <>
                                    {peutEntrer && (
                                      <button
                                        onClick={() => setPieceARanger(p)}
                                        className="text-nikito-cyan text-[11px] font-medium mr-3 hover:underline"
                                      >
                                        Ranger
                                      </button>
                                    )}
                                    {peutEntrer && (
                                      <button
                                        onClick={() => {
                                          modStock.reset();
                                          setMouvementPiece({ id: p.id, nom: p.nom, type: 'entree' });
                                          setParcEntree(p.parc_id ?? '');
                                        }}
                                        className="text-green text-[11px] font-medium mr-3 hover:underline"
                                      >
                                        +Entree
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        modStock.reset();
                                        setMouvementPiece({ id: p.id, nom: p.nom, type: 'sortie' });
                                      }}
                                      className="text-red text-[11px] font-medium hover:underline"
                                    >
                                      -Sortie
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-faint text-[11px]">Lecture seule</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {importFacture && <ModaleImportFacture onClose={() => setImportFacture(false)} />}

      {mouvementPiece && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4">
          <div className="w-full md:max-w-[400px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5">
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">
              {mouvementPiece.type === 'entree' ? 'Entree de stock' : 'Sortie de stock'}
            </div>
            <div className="text-[17px] font-semibold mt-1 mb-4">{mouvementPiece.nom}</div>
            {mouvementPiece.type === 'entree' && (
              <>
                <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">Parc qui reçoit les pièces</label>
                <select
                  value={parcEntree}
                  onChange={(e) => setParcEntree(e.target.value)}
                  className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] mb-4"
                >
                  {parcsChoix.map((c) => (
                    <option key={c.label} value={c.id}>
                      {c.id ? c.label : 'Stock commun'}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">Quantite</label>
            <ChampQuantite
              valeur={mouvementQty}
              onChange={setMouvementQty}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] mb-4"
            />
            {modStock.isError && (
              <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
                Erreur : {(modStock.error as Error).message}
              </div>
            )}
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => { setMouvementPiece(null); setMouvementQty(1); }} className="text-dim text-[12px] px-3 py-2 min-h-[44px]">
                Annuler
              </button>
              <button
                onClick={submitMouvement}
                disabled={modStock.isPending}
                className={cn(
                  'px-5 py-2 rounded-[10px] text-[12px] font-bold min-h-[44px]',
                  mouvementPiece.type === 'entree'
                    ? 'bg-green/15 text-green border border-green/30'
                    : 'bg-red/15 text-red border border-red/30',
                  modStock.isPending && 'opacity-40'
                )}
              >
                {modStock.isPending ? '...' : mouvementPiece.type === 'entree' ? `+${mouvementQty}` : `-${mouvementQty}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {pieceARanger && <ModaleRangerPiece piece={pieceARanger} onClose={() => setPieceARanger(null)} />}

      {modaleCreer && (
        <ModaleCreerPiece
          fournisseurs={fournisseurs ?? []}
          parcIdDefaut={parcIdChoisi}
          onClose={() => setModaleCreer(false)}
        />
      )}
    </div>
  );
}

function ModaleCreerPiece({
  fournisseurs,
  parcIdDefaut,
  onClose,
}: {
  fournisseurs: Array<{ id: string; nom: string }>;
  /** Parc choisi dans la page (vide = stock commun) */
  parcIdDefaut: string;
  onClose: () => void;
}) {
  const creer = useCreerPiece();
  const [reference, setReference] = useState('');
  const [nom, setNom] = useState('');
  const [fournisseurId, setFournisseurId] = useState('');
  const [stockMin, setStockMin] = useState(1);
  const [prixHt, setPrixHt] = useState('');
  const [emplacement, setEmplacement] = useState('');
  const [parcId, setParcId] = useState(parcIdDefaut);
  const [activiteId, setActiviteId] = useState('');

  const submit = async () => {
    if (!reference.trim() || !nom.trim()) return;
    try {
      await creer.mutateAsync({
        reference: reference.trim(),
        nom: nom.trim(),
        fournisseur_id: fournisseurId || null,
        stock_actuel: 0,
        stock_min: stockMin,
        prix_unitaire_ht: prixHt ? parseFloat(prixHt) : null,
        emplacement: emplacement.trim() || null,
        parc_id: parcId || null,
        activite_id: activiteId || null,
      });
      onClose();
    } catch {
      // erreur affichée dans la modale (creer.isError)
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Stock</div>
            <div className="text-[19px] font-semibold mt-0.5">Nouvelle piece</div>
          </div>
          <button onClick={onClose} className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center">
            &times;
          </button>
        </div>
        <div className="grid gap-3.5 mb-5">
          <Field label="Reference *">
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="REF-001" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
          </Field>
          <Field label="Nom *">
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la piece" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
          </Field>
          <Field label="Fournisseur">
            <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]">
              <option value="">Aucun</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Stock min">
              <input type="number" min={0} value={stockMin} onChange={(e) => setStockMin(parseInt(e.target.value) || 0)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
            <Field label="Prix HT (EUR)">
              <input type="text" value={prixHt} onChange={(e) => setPrixHt(e.target.value)} placeholder="0.00" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
          </div>
          <ChampsRangement parcId={parcId} setParcId={setParcId} activiteId={activiteId} setActiviteId={setActiviteId} />
          <Field label="Emplacement">
            <input type="text" value={emplacement} onChange={(e) => setEmplacement(e.target.value)} placeholder="Ex: Etagere A3" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
          </Field>
        </div>
        {creer.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
            Erreur : {(creer.error as Error).message}
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onClose} className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">Annuler</button>
          <button
            onClick={submit}
            disabled={!reference.trim() || !nom.trim() || creer.isPending}
            className={cn('bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]', (!reference.trim() || !nom.trim() || creer.isPending) && 'opacity-40 cursor-not-allowed')}
          >
            {creer.isPending ? 'Creation...' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const CLASSE_CHAMP = 'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

/** Parc (vide = stock commun) et domaine d'une pièce. */
function ChampsRangement({
  parcId,
  setParcId,
  activiteId,
  setActiviteId,
}: {
  parcId: string;
  setParcId: (v: string) => void;
  activiteId: string;
  setActiviteId: (v: string) => void;
}) {
  const { data: parcs } = useParcs();
  const { data: domaines } = useDomaines();
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field label="Parc">
        <select value={parcId} onChange={(e) => setParcId(e.target.value)} className={CLASSE_CHAMP}>
          <option value="">Stock commun</option>
          {((parcs ?? []) as { id: string; code: string; nom: string }[]).map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.nom}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Domaine">
        <select value={activiteId} onChange={(e) => setActiviteId(e.target.value)} className={CLASSE_CHAMP}>
          <option value="">À classer</option>
          {(domaines ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.nom}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function ModaleRangerPiece({ piece, onClose }: { piece: PieceDetacheeAvecJoins; onClose: () => void }) {
  const toast = useToast();
  const ranger = useRangerPiece();
  const [parcId, setParcId] = useState(piece.parc_id ?? '');
  const [activiteId, setActiviteId] = useState(piece.activite_id ?? '');
  const [emplacement, setEmplacement] = useState(piece.emplacement ?? '');

  const submit = async () => {
    try {
      await ranger.mutateAsync({ id: piece.id, parc_id: parcId || null, activite_id: activiteId || null, emplacement: emplacement.trim() || null });
      toast.success(`${piece.nom} rangée`);
      onClose();
    } catch {
      // erreur affichée dans la modale (ranger.isError)
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[460px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Ranger la pièce</div>
        <div className="text-[17px] font-semibold mt-1 mb-4">
          {piece.nom} <span className="text-[12px] font-mono text-nikito-cyan">{piece.reference}</span>
        </div>
        <div className="grid gap-3.5 mb-4">
          <ChampsRangement parcId={parcId} setParcId={setParcId} activiteId={activiteId} setActiviteId={setActiviteId} />
          <Field label="Emplacement">
            <input type="text" value={emplacement} onChange={(e) => setEmplacement(e.target.value)} placeholder="Ex: Etagere A3" className={CLASSE_CHAMP} />
          </Field>
        </div>
        {ranger.isError && <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">Erreur : {(ranger.error as Error).message}</div>}
        <div className="flex gap-2.5 justify-end">
          <button onClick={onClose} className="text-dim text-[12px] px-3 py-2 min-h-[44px]">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={ranger.isPending}
            className={cn('bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]', ranger.isPending && 'opacity-40')}
          >
            {ranger.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Compteur({ label, value, color }: { label: string; value: string; color?: 'red' }) {
  return (
    <div className="bg-bg-card rounded-xl px-4 py-2.5 border border-white/[0.06] min-w-[100px]">
      <div className="text-[10px] text-dim uppercase tracking-wider">{label}</div>
      <div className={cn('text-lg font-semibold', color === 'red' ? 'text-red' : 'text-text')}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}
