import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTechnicienKartingEffectif } from '@/hooks/useViewAs';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import { useToast } from '@/components/ui/ToastProvider';
import { envoyerFichier } from '@/lib/envoiGrosFichier';

const BUCKET = 'alba-catalogue';
const MODELE = 'Sodi RSX2 V2';
const ROLES_CATALOGUE = ['chef_maintenance', 'direction', 'admin_it'];

interface Ensemble {
  id: string;
  nom: string;
  ordre: number;
  image_chemin: string | null;
  image_mime: string | null;
}

interface PieceCatalogue {
  id: string;
  ensemble_id: string;
  repere: string | null;
  reference: string;
  designation: string;
  quantite: number | null;
  prix_ht: number | null;
  piece_id: string | null;
  ordre: number;
}

/** Ligne en cours de saisie (import ou ajout manuel) */
interface LigneSaisie {
  repere: string;
  reference: string;
  designation: string;
  quantite: string;
  prix_ht: string;
}

const champ =
  'w-full min-w-0 bg-bg-deep border border-white/[0.08] rounded-lg px-2 py-1.5 text-[13px] text-text outline-none focus:border-nikito-cyan';
const prix = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const nombre = (t: string) => {
  const v = parseFloat(t.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
const versLigne = (p: Partial<PieceCatalogue>): LigneSaisie => ({
  repere: p.repere ?? '',
  reference: p.reference ?? '',
  designation: p.designation ?? '',
  quantite: p.quantite === null || p.quantite === undefined ? '' : String(p.quantite),
  prix_ht: p.prix_ht === null || p.prix_ht === undefined ? '' : String(p.prix_ht),
});
const nomPropre = (n: string) => n.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);

function useEnsembles() {
  return useQuery({
    queryKey: ['catalogue-karting', 'ensembles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalogue_ensembles')
        .select('id, nom, ordre, image_chemin, image_mime')
        .eq('actif', true)
        .order('ordre')
        .order('nom');
      if (error) throw error;
      return (data ?? []) as Ensemble[];
    },
  });
}

function usePiecesCatalogue() {
  return useQuery({
    queryKey: ['catalogue-karting', 'pieces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalogue_pieces')
        .select('id, ensemble_id, repere, reference, designation, quantite, prix_ht, piece_id, ordre')
        .order('ordre');
      if (error) throw error;
      return (data ?? []) as PieceCatalogue[];
    },
  });
}

/** Stock actuel des pièces du catalogue (fiches du stock Karting reliées) */
function useStockCatalogue() {
  return useQuery({
    queryKey: ['catalogue-karting', 'stock'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stock_pieces_catalogue');
      if (error) throw error;
      const m = new Map<string, { stock: number; emplacement: string | null }>();
      for (const l of (data ?? []) as { catalogue_piece_id: string; stock_actuel: number; emplacement: string | null }[]) {
        m.set(l.catalogue_piece_id, { stock: l.stock_actuel, emplacement: l.emplacement });
      }
      return m;
    },
  });
}

/**
 * Catalogue pièces karting interne (Sodi RSX2 V2) : vues éclatées et
 * références, rangées par ensemble, alimentées par capture du catalogue
 * constructeur (lue automatiquement, puis vérifiée). Chaque pièce est entrée
 * au stock Karting. Chef d'équipe, direction, admin IT et technicien Karting.
 */
export function PageCatalogueKarting() {
  const { utilisateur } = useAuth();
  const karting = useTechnicienKartingEffectif(utilisateur);
  const autorise = karting || ROLES_CATALOGUE.includes(utilisateur?.role_code ?? '');
  if (utilisateur && !autorise) return <Navigate to="/gmao" replace />;
  return <ContenuCatalogue />;
}

function ContenuCatalogue() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const ensembleId = params.get('ensemble');
  const { data: ensembles, isLoading } = useEnsembles();
  const { data: pieces } = usePiecesCatalogue();
  const { data: stock } = useStockCatalogue();
  const [recherche, setRecherche] = useState('');
  const [importer, setImporter] = useState(false);
  const [nouvelEnsemble, setNouvelEnsemble] = useState(false);

  const { data: urls } = useSignedUrls((ensembles ?? []).map((e) => e.image_chemin), BUCKET);
  const nbParEnsemble = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pieces ?? []) m.set(p.ensemble_id, (m.get(p.ensemble_id) ?? 0) + 1);
    return m;
  }, [pieces]);
  const nomEnsemble = useMemo(() => new Map((ensembles ?? []).map((e) => [e.id, e.nom])), [ensembles]);

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2) return [];
    return (pieces ?? [])
      .filter((p) => [p.reference, p.designation, p.repere].filter(Boolean).join(' ').toLowerCase().includes(q))
      .slice(0, 100);
  }, [pieces, recherche]);

  const ouvrir = (id: string | null) => {
    setRecherche('');
    setParams(id ? { ensemble: id } : {}, { replace: false });
  };
  const rafraichir = () => qc.invalidateQueries({ queryKey: ['catalogue-karting'] });

  const ensemble = (ensembles ?? []).find((e) => e.id === ensembleId) ?? null;

  if (ensemble) {
    return (
      <FicheEnsemble
        ensemble={ensemble}
        url={ensemble.image_chemin ? urls?.[ensemble.image_chemin] : undefined}
        pieces={(pieces ?? []).filter((p) => p.ensemble_id === ensemble.id)}
        stock={stock}
        onRetour={() => ouvrir(null)}
        onChange={rafraichir}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Catalogue karting</h1>
          <p className="text-[13px] text-dim mt-1">
            {MODELE} · vues éclatées et références · {(pieces ?? []).length} pièce{(pieces ?? []).length > 1 ? 's' : ''} dans{' '}
            {(ensembles ?? []).length} ensemble{(ensembles ?? []).length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setNouvelEnsemble(true)}
            className="bg-bg-deep border border-white/[0.08] text-text px-4 py-2.5 rounded-[10px] text-[13px] min-h-[44px]"
          >
            + Ensemble vide
          </button>
          <button
            onClick={() => setImporter(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
          >
            📷 Importer une capture
          </button>
        </div>
      </div>

      {importer && (
        <ModaleImport
          ensembles={ensembles ?? []}
          onClose={() => setImporter(false)}
          onFini={(id) => {
            setImporter(false);
            rafraichir();
            ouvrir(id);
          }}
        />
      )}
      {nouvelEnsemble && (
        <ModaleNouvelEnsemble
          ordre={(ensembles ?? []).length}
          onClose={() => setNouvelEnsemble(false)}
          onFini={(id) => {
            setNouvelEnsemble(false);
            rafraichir();
            ouvrir(id);
          }}
        />
      )}

      <input
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Rechercher une pièce (nom, référence, repère)…"
        className="w-full bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px] mb-4"
      />

      {recherche.trim().length >= 2 ? (
        resultats.length === 0 ? (
          <div className="text-center py-12 text-dim text-sm">Aucune pièce trouvée.</div>
        ) : (
          <TableauPieces
            pieces={resultats}
            stock={stock}
            nomEnsemble={(id) => nomEnsemble.get(id) ?? ''}
            onEnsemble={(id) => ouvrir(id)}
          />
        )
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : (ensembles ?? []).length === 0 ? (
        <div className="bg-bg-card rounded-xl p-6 text-center text-[13px] text-dim max-w-[620px] mx-auto">
          <div className="text-3xl mb-2">🏎️</div>
          Le catalogue est vide. Sur le catalogue constructeur, ouvre un ensemble du kart (vue éclatée + liste des pièces), fais
          une capture d'écran, puis <strong className="text-text">📷 Importer une capture</strong> : ALBA lit les repères,
          références et désignations, tu vérifies, et les pièces entrent dans le catalogue et le stock Karting.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(ensembles ?? []).map((e) => {
            const url = e.image_chemin ? urls?.[e.image_chemin] : undefined;
            return (
              <button
                key={e.id}
                onClick={() => ouvrir(e.id)}
                className="bg-bg-card rounded-xl border border-white/[0.06] overflow-hidden text-left hover:border-nikito-cyan/40 transition-colors"
              >
                {url && e.image_mime !== 'application/pdf' ? (
                  <img src={url} alt="" loading="lazy" className="w-full h-36 object-contain bg-white" />
                ) : (
                  <div className="w-full h-36 bg-bg-deep flex items-center justify-center text-4xl text-dim">🔧</div>
                )}
                <div className="p-3">
                  <div className="text-[14px] font-semibold">{e.nom}</div>
                  <div className="text-[12px] text-dim">
                    {nbParEnsemble.get(e.id) ?? 0} pièce{(nbParEnsemble.get(e.id) ?? 0) > 1 ? 's' : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TableauPieces({
  pieces,
  stock,
  nomEnsemble,
  onEnsemble,
  onModifier,
  onSupprimer,
}: {
  pieces: PieceCatalogue[];
  stock?: Map<string, { stock: number; emplacement: string | null }>;
  nomEnsemble?: (id: string) => string;
  onEnsemble?: (id: string) => void;
  onModifier?: (p: PieceCatalogue) => void;
  onSupprimer?: (p: PieceCatalogue) => void;
}) {
  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06] overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-dim uppercase tracking-wider border-b border-white/[0.06]">
            <th className="px-3 py-2 w-12">Rep.</th>
            <th className="px-3 py-2">Référence</th>
            <th className="px-3 py-2">Désignation</th>
            {nomEnsemble && <th className="px-3 py-2">Ensemble</th>}
            <th className="px-3 py-2 text-right">Qté</th>
            <th className="px-3 py-2 text-right">Prix HT</th>
            <th className="px-3 py-2 text-right">Stock</th>
            {(onModifier || onSupprimer) && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {pieces.map((p) => {
            const s = stock?.get(p.id);
            return (
              <tr key={p.id} className="border-b border-white/[0.04] last:border-0">
                <td className="px-3 py-2 text-dim">{p.repere ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-[12px] text-nikito-cyan whitespace-nowrap">{p.reference}</td>
                <td className="px-3 py-2">{p.designation}</td>
                {nomEnsemble && (
                  <td className="px-3 py-2">
                    <button onClick={() => onEnsemble?.(p.ensemble_id)} className="text-nikito-cyan underline-offset-2 hover:underline">
                      {nomEnsemble(p.ensemble_id)}
                    </button>
                  </td>
                )}
                <td className="px-3 py-2 text-right text-dim">{p.quantite ?? '—'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{prix(p.prix_ht)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {s ? (
                    <span className={cn('font-semibold', s.stock > 0 ? 'text-green' : 'text-dim')} title={s.emplacement ?? undefined}>
                      {s.stock}
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                {(onModifier || onSupprimer) && (
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {onModifier && (
                      <button onClick={() => onModifier(p)} className="text-dim hover:text-text px-1.5 min-h-[36px]" aria-label="Modifier">
                        ✏️
                      </button>
                    )}
                    {onSupprimer && (
                      <button onClick={() => onSupprimer(p)} className="text-dim hover:text-red px-1.5 min-h-[36px]" aria-label="Retirer">
                        🗑
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FicheEnsemble({
  ensemble,
  url,
  pieces,
  stock,
  onRetour,
  onChange,
}: {
  ensemble: Ensemble;
  url?: string;
  pieces: PieceCatalogue[];
  stock?: Map<string, { stock: number; emplacement: string | null }>;
  onRetour: () => void;
  onChange: () => void;
}) {
  const toast = useToast();
  const [zoom, setZoom] = useState(false);
  const [edition, setEdition] = useState<{ piece: PieceCatalogue | null; ligne: LigneSaisie } | null>(null);
  const [importer, setImporter] = useState(false);
  const [renommer, setRenommer] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const enregistrerLigne = async () => {
    if (!edition) return;
    const l = edition.ligne;
    if (!l.reference.trim() || !l.designation.trim()) {
      toast.error('Référence et désignation obligatoires');
      return;
    }
    setEnCours(true);
    const valeurs = {
      repere: l.repere.trim() || null,
      reference: l.reference.trim(),
      designation: l.designation.trim(),
      quantite: nombre(l.quantite),
      prix_ht: nombre(l.prix_ht),
    };
    const { error } = edition.piece
      ? await supabase
          .from('catalogue_pieces')
          .update({ ...valeurs, ...(valeurs.reference !== edition.piece.reference ? { piece_id: null } : {}) })
          .eq('id', edition.piece.id)
      : await supabase.from('catalogue_pieces').insert({ ...valeurs, ensemble_id: ensemble.id, ordre: pieces.length });
    if (!error) await supabase.rpc('catalogue_vers_stock', { p_ensemble_id: ensemble.id });
    setEnCours(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(edition.piece ? 'Pièce modifiée' : 'Pièce ajoutée (et au stock Karting)');
    setEdition(null);
    onChange();
  };

  const supprimer = async (p: PieceCatalogue) => {
    if (!window.confirm(`Retirer « ${p.designation} » (${p.reference}) du catalogue ? La fiche du stock est conservée.`)) return;
    const { error } = await supabase.from('catalogue_pieces').delete().eq('id', p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info('Pièce retirée du catalogue');
    onChange();
  };

  const enregistrerNom = async () => {
    const nom = (renommer ?? '').trim();
    if (!nom) return;
    const { error } = await supabase.from('catalogue_ensembles').update({ nom }).eq('id', ensemble.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRenommer(null);
    onChange();
  };

  const retirerEnsemble = async () => {
    if (!window.confirm(`Retirer l'ensemble « ${ensemble.nom} » du catalogue ? Les fiches du stock sont conservées.`)) return;
    const { error } = await supabase.from('catalogue_ensembles').update({ actif: false }).eq('id', ensemble.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info('Ensemble retiré');
    onChange();
    onRetour();
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <button onClick={onRetour} className="text-nikito-cyan text-[13px] mb-3 min-h-[36px]">
        ← Catalogue karting
      </button>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        {renommer !== null ? (
          <div className="flex gap-2 items-center">
            <input value={renommer} onChange={(e) => setRenommer(e.target.value)} autoFocus className={cn(champ, 'text-[16px] min-h-[40px]')} />
            <button onClick={enregistrerNom} className="text-nikito-cyan text-[13px] font-semibold px-2 min-h-[40px]">
              OK
            </button>
          </div>
        ) : (
          <div>
            <h1 className="text-xl md:text-[22px] font-semibold m-0">{ensemble.nom}</h1>
            <p className="text-[13px] text-dim mt-1">
              {MODELE} · {pieces.length} pièce{pieces.length > 1 ? 's' : ''} ·{' '}
              <button onClick={() => setRenommer(ensemble.nom)} className="text-nikito-cyan underline-offset-2 hover:underline">
                renommer
              </button>{' '}
              ·{' '}
              <button onClick={retirerEnsemble} className="text-dim underline-offset-2 hover:underline">
                retirer
              </button>
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImporter(true)}
            className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-4 py-2.5 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
          >
            📷 Ajouter depuis une capture
          </button>
          <button
            onClick={() => setEdition({ piece: null, ligne: versLigne({}) })}
            className="bg-gradient-cta text-text px-4 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
          >
            + Pièce
          </button>
        </div>
      </div>

      {importer && (
        <ModaleImport
          ensembles={[ensemble]}
          ensembleImpose={ensemble}
          onClose={() => setImporter(false)}
          onFini={() => {
            setImporter(false);
            onChange();
          }}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="bg-white rounded-xl overflow-hidden min-h-[200px] flex items-center justify-center">
          {url && ensemble.image_mime !== 'application/pdf' ? (
            <button onClick={() => setZoom(true)} className="block w-full cursor-zoom-in">
              <img src={url} alt={`Vue éclatée ${ensemble.nom}`} className="w-full h-auto object-contain" />
            </button>
          ) : url ? (
            <a href={url} target="_blank" rel="noreferrer" className="text-bg-app text-[13px] font-semibold p-6">
              📄 Ouvrir la vue éclatée (PDF)
            </a>
          ) : (
            <div className="text-[13px] text-dim p-6 bg-bg-deep w-full h-full flex items-center justify-center">
              Pas de vue éclatée — « Ajouter depuis une capture » l'enregistre
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {edition && (
            <div className="bg-bg-card rounded-xl border border-nikito-cyan/30 p-3 grid gap-2">
              <div className="text-[13px] font-semibold">{edition.piece ? 'Modifier la pièce' : 'Nouvelle pièce'}</div>
              <SaisieLigne ligne={edition.ligne} onChange={(ligne) => setEdition({ ...edition, ligne })} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEdition(null)} className="text-dim text-[13px] px-3 min-h-[40px]">
                  Annuler
                </button>
                <button
                  onClick={enregistrerLigne}
                  disabled={enCours}
                  className={cn('bg-nikito-cyan text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[40px]', enCours && 'opacity-50')}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}
          {pieces.length === 0 ? (
            <div className="bg-bg-card rounded-xl p-5 text-center text-[13px] text-dim">Aucune pièce dans cet ensemble.</div>
          ) : (
            <TableauPieces
              pieces={pieces}
              stock={stock}
              onModifier={(p) => setEdition({ piece: p, ligne: versLigne(p) })}
              onSupprimer={supprimer}
            />
          )}
        </div>
      </div>

      {zoom && url && (
        <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoom(false)}>
          <img src={url} alt="" className="max-w-full max-h-full object-contain bg-white" />
        </div>
      )}
    </div>
  );
}

function SaisieLigne({ ligne, onChange }: { ligne: LigneSaisie; onChange: (l: LigneSaisie) => void }) {
  const maj = (k: keyof LigneSaisie) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...ligne, [k]: e.target.value });
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[56px_150px_minmax(0,1fr)_64px_84px] gap-1.5">
      <input value={ligne.repere} onChange={maj('repere')} placeholder="Rep." className={champ} />
      <input value={ligne.reference} onChange={maj('reference')} placeholder="Référence *" className={cn(champ, 'font-mono')} />
      <input value={ligne.designation} onChange={maj('designation')} placeholder="Désignation *" className={cn(champ, 'col-span-2 sm:col-span-1')} />
      <input value={ligne.quantite} onChange={maj('quantite')} placeholder="Qté" inputMode="decimal" className={champ} />
      <input value={ligne.prix_ht} onChange={maj('prix_ht')} placeholder="Prix HT" inputMode="decimal" className={champ} />
    </div>
  );
}

function ModaleNouvelEnsemble({ ordre, onClose, onFini }: { ordre: number; onClose: () => void; onFini: (id: string) => void }) {
  const toast = useToast();
  const { utilisateur } = useAuth();
  const [nom, setNom] = useState('');
  const creer = async () => {
    if (!nom.trim()) return;
    const { data, error } = await supabase
      .from('catalogue_ensembles')
      .insert({ nom: nom.trim(), ordre, cree_par_id: utilisateur?.id ?? null })
      .select('id')
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    onFini(data.id as string);
  };
  return (
    <Fenetre titre="Nouvel ensemble" onClose={onClose}>
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Freinage, Direction, Châssis…" autoFocus className={cn(champ, 'min-h-[44px]')} />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-dim text-[13px] px-3 min-h-[44px]">
          Annuler
        </button>
        <button onClick={creer} disabled={!nom.trim()} className="bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-40">
          Créer
        </button>
      </div>
    </Fenetre>
  );
}

/**
 * Import d'une capture du catalogue constructeur : envoi, lecture automatique
 * (repères, références, désignations), vérification, puis enregistrement dans
 * l'ensemble (nouveau ou existant) et entrée au stock Karting.
 */
function ModaleImport({
  ensembles,
  ensembleImpose,
  onClose,
  onFini,
}: {
  ensembles: Ensemble[];
  ensembleImpose?: Ensemble;
  onClose: () => void;
  onFini: (ensembleId: string) => void;
}) {
  const toast = useToast();
  const { utilisateur } = useAuth();
  const [etape, setEtape] = useState<'fichier' | 'lecture' | 'verification' | 'enregistrement'>('fichier');
  const [fichier, setFichier] = useState<File | null>(null);
  const [chemin, setChemin] = useState<string | null>(null);
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [cible, setCible] = useState<string>(ensembleImpose?.id ?? '');
  const [nomNouveau, setNomNouveau] = useState('');
  const [garderImage, setGarderImage] = useState(true);

  const lire = async () => {
    if (!fichier) return;
    setEtape('lecture');
    try {
      const c = `ensembles/${Date.now()}_${nomPropre(fichier.name)}`;
      await envoyerFichier(BUCKET, c, fichier);
      setChemin(c);
      const { data, error } = await supabase.functions.invoke('lire-catalogue-pieces', {
        body: { chemin: c, mime: fichier.type || null },
      });
      if (error || data?.success === false) throw new Error(data?.error ?? error?.message ?? 'Lecture impossible');
      const lues = (data.pieces ?? []) as Partial<PieceCatalogue>[];
      setLignes(lues.length ? lues.map(versLigne) : [versLigne({})]);
      if (!ensembleImpose) setNomNouveau((data.ensemble as string | null) ?? '');
      if (!lues.length) toast.info('Aucune pièce lue : complète le tableau à la main');
      setEtape('verification');
    } catch (e) {
      toast.error((e as Error).message);
      setEtape('fichier');
    }
  };

  const enregistrer = async () => {
    const valides = lignes.filter((l) => l.reference.trim() && l.designation.trim());
    if (!valides.length) {
      toast.error('Aucune pièce avec référence et désignation');
      return;
    }
    setEtape('enregistrement');
    try {
      let ensembleId = cible;
      const estImage = !!fichier;
      if (!ensembleId) {
        if (!nomNouveau.trim()) throw new Error("Donne un nom à l'ensemble");
        const { data, error } = await supabase
          .from('catalogue_ensembles')
          .insert({
            nom: nomNouveau.trim(),
            ordre: ensembles.length,
            image_chemin: garderImage && estImage ? chemin : null,
            image_mime: garderImage && estImage ? fichier?.type || null : null,
            cree_par_id: utilisateur?.id ?? null,
          })
          .select('id')
          .single();
        if (error) throw error;
        ensembleId = data.id as string;
      } else if (garderImage && chemin) {
        const existant = ensembles.find((e) => e.id === ensembleId);
        if (!existant?.image_chemin) {
          await supabase.from('catalogue_ensembles').update({ image_chemin: chemin, image_mime: fichier?.type || null }).eq('id', ensembleId);
        }
      }
      const { error: errPieces } = await supabase.from('catalogue_pieces').insert(
        valides.map((l, i) => ({
          ensemble_id: ensembleId,
          repere: l.repere.trim() || null,
          reference: l.reference.trim(),
          designation: l.designation.trim(),
          quantite: nombre(l.quantite),
          prix_ht: nombre(l.prix_ht),
          ordre: i,
        }))
      );
      if (errPieces) throw errPieces;
      const { data: bilan, error: errStock } = await supabase.rpc('catalogue_vers_stock', { p_ensemble_id: ensembleId });
      if (errStock) throw errStock;
      const b = bilan as { crees: number; relies: number } | null;
      toast.success(
        `${valides.length} pièce${valides.length > 1 ? 's' : ''} enregistrée${valides.length > 1 ? 's' : ''} · stock Karting : ${b?.crees ?? 0} ajoutée${(b?.crees ?? 0) > 1 ? 's' : ''}, ${b?.relies ?? 0} déjà en stock`
      );
      onFini(ensembleId);
    } catch (e) {
      toast.error((e as Error).message);
      setEtape('verification');
    }
  };

  return (
    <Fenetre titre={ensembleImpose ? `Ajouter à « ${ensembleImpose.nom} »` : 'Importer une capture du catalogue'} onClose={onClose} large>
      {etape === 'fichier' && (
        <>
          <p className="text-[13px] text-dim m-0">
            Sur le catalogue constructeur, ouvre un ensemble du kart et fais une capture d'écran de la vue éclatée avec la liste des
            pièces (ou un PDF). ALBA lit les repères, références et désignations ; tu vérifies avant d'enregistrer.
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
            className="text-[13px] text-dim file:mr-3 file:rounded-lg file:border-0 file:bg-nikito-cyan/15 file:text-nikito-cyan file:px-3 file:py-2"
          />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="text-dim text-[13px] px-3 min-h-[44px]">
              Annuler
            </button>
            <button onClick={lire} disabled={!fichier} className="bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-40">
              Lire la capture
            </button>
          </div>
        </>
      )}
      {etape === 'lecture' && <div className="py-10 text-center text-[13px] text-dim animate-pulse">Lecture de la capture… (quelques secondes)</div>}
      {(etape === 'verification' || etape === 'enregistrement') && (
        <>
          {!ensembleImpose && (
            <div className="grid sm:grid-cols-2 gap-2">
              <select value={cible} onChange={(e) => setCible(e.target.value)} className={cn(champ, 'min-h-[40px]')}>
                <option value="">Nouvel ensemble</option>
                {ensembles.map((e) => (
                  <option key={e.id} value={e.id}>
                    Ajouter à : {e.nom}
                  </option>
                ))}
              </select>
              {!cible && (
                <input
                  value={nomNouveau}
                  onChange={(e) => setNomNouveau(e.target.value)}
                  placeholder="Nom de l'ensemble (ex. Freinage)"
                  className={cn(champ, 'min-h-[40px]')}
                />
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-[12px] text-dim">
            <input type="checkbox" checked={garderImage} onChange={(e) => setGarderImage(e.target.checked)} className="accent-nikito-cyan" />
            Garder la capture comme vue éclatée de l'ensemble
          </label>
          <div className="text-[12px] text-dim">
            {lignes.length} ligne{lignes.length > 1 ? 's' : ''} lue{lignes.length > 1 ? 's' : ''} — vérifie et corrige si besoin :
          </div>
          <div className="grid gap-1.5 max-h-[45vh] overflow-y-auto pr-1">
            {lignes.map((l, i) => (
              <div key={i} className="flex gap-1.5 items-start">
                <div className="flex-1 min-w-0">
                  <SaisieLigne ligne={l} onChange={(n) => setLignes((ls) => ls.map((x, j) => (j === i ? n : x)))} />
                </div>
                <button onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} className="text-dim hover:text-red px-1.5 min-h-[34px]" aria-label="Retirer la ligne">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setLignes((ls) => [...ls, versLigne({})])} className="self-start text-nikito-cyan text-[12px] min-h-[36px]">
            + Ajouter une ligne
          </button>
          <div className="text-[11px] text-faint">
            À l'enregistrement, chaque pièce entre aussi dans le stock Karting : référence déjà au stock → reliée, sinon fiche créée
            (quantité 0, à compléter).
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="text-dim text-[13px] px-3 min-h-[44px]">
              Annuler
            </button>
            <button
              onClick={enregistrer}
              disabled={etape === 'enregistrement'}
              className="bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-40"
            >
              {etape === 'enregistrement' ? 'Enregistrement…' : `Enregistrer et entrer au stock`}
            </button>
          </div>
        </>
      )}
    </Fenetre>
  );
}

function Fenetre({ titre, onClose, large, children }: { titre: string; onClose: () => void; large?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className={cn(
          'w-full bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-white/[0.08] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3 max-h-[92vh] overflow-y-auto',
          large ? 'md:max-w-[860px]' : 'md:max-w-[440px]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-bold">{titre}</div>
        {children}
      </div>
    </div>
  );
}
