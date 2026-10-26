import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import {
  useCatalogueCommandes,
  useEnregistrerActivite,
  useEnregistrerProduit,
  useSupprimerElementCatalogue,
  type ActiviteCommande,
  type ProduitCommande,
} from '@/hooks/queries/useCommandes';
import { usePiecesStockOptions } from '@/hooks/queries/useStockOptions';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { formatPrix } from './format';

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

export function GestionCatalogue() {
  const { data, isLoading } = useCatalogueCommandes(true);
  const supprimer = useSupprimerElementCatalogue();
  const toast = useToast();
  const [activiteEditee, setActiviteEditee] = useState<Partial<ActiviteCommande> | null>(null);
  const [produitEdite, setProduitEdite] = useState<Partial<ProduitCommande> | null>(null);

  if (isLoading) return <div className="bg-bg-card rounded-xl h-40 animate-pulse" />;
  const activites = data?.activites ?? [];
  const produits = data?.produits ?? [];

  const confirmerSuppression = async (table: 'commande_activites' | 'commande_produits', id: string, nom: string) => {
    const msg =
      table === 'commande_activites'
        ? `Supprimer l'activité « ${nom} » et tous ses produits ?`
        : `Supprimer le produit « ${nom} » ?`;
    if (!window.confirm(msg)) return;
    try {
      await supprimer.mutateAsync({ table, id });
      toast.success('Supprimé');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2.5 sm:justify-between sm:items-center mb-4">
        <p className="text-[13px] text-dim m-0">
          {activites.length} activité{activites.length > 1 ? 's' : ''} · {produits.length} produit
          {produits.length > 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setActiviteEditee({ actif: true, ordre: activites.length })}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
        >
          + Nouvelle activité
        </button>
      </div>

      {activites.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">
          Commence par créer une activité (ex. Karting, Arcade, Bar…), puis ajoute-lui des produits.
        </div>
      ) : (
        <div className="space-y-4">
          {activites.map((a) => {
            const siens = produits.filter((p) => p.activite_id === a.id);
            return (
              <div key={a.id} className="bg-bg-card rounded-xl border border-white/[0.06]">
                <div className="flex items-center gap-3 p-4 border-b border-white/[0.04]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold flex items-center gap-2">
                      {a.nom}
                      {!a.actif && <span className="text-[10px] bg-white/[0.06] text-dim px-1.5 py-0.5 rounded">Masquée</span>}
                      <BadgeParcs ids={a.parc_ids} />
                      {a.sans_validation && (
                        <span className="text-[10px] bg-amber/15 text-amber px-1.5 py-0.5 rounded">Sans validation</span>
                      )}
                    </div>
                    {a.description && <div className="text-[12px] text-dim">{a.description}</div>}
                  </div>
                  <button
                    onClick={() => setProduitEdite({ activite_id: a.id, actif: true, unite: /arcade/i.test(a.nom) ? 'carton' : 'unité', ordre: siens.length })}
                    className="text-nikito-cyan text-[12px] font-medium min-h-[36px] px-2 hover:underline"
                  >
                    + Produit
                  </button>
                  <button onClick={() => setActiviteEditee(a)} className="text-dim text-[12px] min-h-[36px] px-2 hover:text-text">
                    Modifier
                  </button>
                  <button
                    onClick={() => confirmerSuppression('commande_activites', a.id, a.nom)}
                    className="text-red text-[12px] min-h-[36px] px-2 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
                {siens.length === 0 ? (
                  <div className="p-4 text-[12px] text-faint">Aucun produit dans cette activité.</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {siens.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-[13px] flex items-center gap-2', !p.actif && 'text-faint line-through')}>
                            {p.nom}
                            <BadgeParcs ids={p.parc_ids} />
                          </div>
                          <div className="text-[11px] text-dim">
                            {[p.reference, `${formatPrix(p.prix_unitaire)} / ${p.unite}`].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <button onClick={() => setProduitEdite(p)} className="text-dim text-[12px] min-h-[36px] px-2 hover:text-text">
                          Modifier
                        </button>
                        <button
                          onClick={() => confirmerSuppression('commande_produits', p.id, p.nom)}
                          className="text-red text-[12px] min-h-[36px] px-2 hover:underline"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activiteEditee && <ModaleActivite initiale={activiteEditee} onClose={() => setActiviteEditee(null)} />}
      {produitEdite && (
        <ModaleProduit initial={produitEdite} activites={activites} onClose={() => setProduitEdite(null)} />
      )}
    </div>
  );
}

type ParcCourt = { id: string; code: string; nom: string };

/** Codes des parcs qui voient l'élément (rien si tous les parcs). */
function BadgeParcs({ ids }: { ids: string[] | undefined }) {
  const { data } = useParcs();
  if (!ids?.length) return null;
  const codes = ((data ?? []) as ParcCourt[]).filter((p) => ids.includes(p.id)).map((p) => p.code);
  return (
    <span className="text-[10px] bg-nikito-cyan/10 text-nikito-cyan px-1.5 py-0.5 rounded font-normal no-underline">
      {codes.length ? codes.join(' · ') : `${ids.length} parc(s)`}
    </span>
  );
}

/** Visibilité par parc : aucun parc coché = tous les parcs. */
function ChoixParcs({ valeur, onChange, quoi }: { valeur: string[]; onChange: (ids: string[]) => void; quoi: string }) {
  const { data } = useParcs();
  const parcs = (data ?? []) as ParcCourt[];
  const basculer = (id: string) => onChange(valeur.includes(id) ? valeur.filter((x) => x !== id) : [...valeur, id]);
  return (
    <Field label="Parcs qui voient">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            'px-3 rounded-full text-[12px] min-h-[36px] border',
            valeur.length === 0 ? 'bg-nikito-cyan/15 border-nikito-cyan/50 text-nikito-cyan' : 'bg-bg-deep border-white/[0.08] text-dim'
          )}
        >
          Tous les parcs
        </button>
        {parcs.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => basculer(p.id)}
            className={cn(
              'px-3 rounded-full text-[12px] min-h-[36px] border',
              valeur.includes(p.id) ? 'bg-nikito-cyan/15 border-nikito-cyan/50 text-nikito-cyan' : 'bg-bg-deep border-white/[0.08] text-dim'
            )}
          >
            {p.code} · {p.nom}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-faint mt-1">
        {valeur.length === 0 ? `Tous les parcs voient ${quoi}.` : `Seuls les parcs cochés voient ${quoi}.`}
      </div>
    </Field>
  );
}

function Modale({ titre, onClose, children }: { titre: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Catalogue commandes</div>
            <div className="text-[19px] font-semibold mt-0.5">{titre}</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
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

function BoutonsModale({ onClose, onSave, disabled, pending }: { onClose: () => void; onSave: () => void; disabled: boolean; pending: boolean }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end mt-5">
      <button onClick={onClose} className="border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">
        Annuler
      </button>
      <button
        onClick={onSave}
        disabled={disabled || pending}
        className={cn(
          'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
          (disabled || pending) && 'opacity-40 cursor-not-allowed'
        )}
      >
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  );
}

/** Personnes qui reçoivent les commandes directes d'une activité. */
function ChoixDestinataires({ valeur, onChange }: { valeur: string[]; onChange: (ids: string[]) => void }) {
  const { data: equipe } = useQuery({
    queryKey: ['destinataires-commandes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utilisateurs')
        .select('id, prenom, nom, email, roles!inner(code)')
        .eq('actif', true)
        .not('email', 'is', null)
        .neq('roles.code', 'staff_operationnel')
        .order('prenom');
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; prenom: string; nom: string; email: string }[];
    },
  });
  const basculer = (id: string) => onChange(valeur.includes(id) ? valeur.filter((v) => v !== id) : [...valeur, id]);
  return (
    <Field label="Destinataires des commandes">
      <div className="max-h-[200px] overflow-y-auto flex flex-col gap-0.5 bg-bg-deep rounded-[10px] p-2">
        {(equipe ?? []).map((u) => (
          <label key={u.id} className="flex items-center gap-2 px-1.5 py-1 text-[13px] cursor-pointer min-h-[36px]">
            <input type="checkbox" checked={valeur.includes(u.id)} onChange={() => basculer(u.id)} />
            {u.prenom} {u.nom}
            <span className="text-faint text-[11px]">· {u.email}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

function ModaleActivite({ initiale, onClose }: { initiale: Partial<ActiviteCommande>; onClose: () => void }) {
  const enregistrer = useEnregistrerActivite();
  const toast = useToast();
  const [nom, setNom] = useState(initiale.nom ?? '');
  const [description, setDescription] = useState(initiale.description ?? '');
  const [actif, setActif] = useState(initiale.actif ?? true);
  const [parcIds, setParcIds] = useState<string[]>(initiale.parc_ids ?? []);
  const [sansValidation, setSansValidation] = useState(initiale.sans_validation ?? false);
  const [destinataires, setDestinataires] = useState<string[]>(initiale.destinataire_ids ?? []);
  const destinatairesManquants = sansValidation && destinataires.length === 0;

  const save = async () => {
    try {
      await enregistrer.mutateAsync({
        id: initiale.id,
        nom: nom.trim(),
        description: description.trim() || null,
        ordre: initiale.ordre ?? 0,
        actif,
        parc_ids: parcIds,
        sans_validation: sansValidation,
        destinataire_ids: sansValidation ? destinataires : [],
      });
      toast.success('Activité enregistrée');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modale titre={initiale.id ? "Modifier l'activité" : 'Nouvelle activité'} onClose={onClose}>
      <div className="grid gap-3.5">
        <Field label="Nom *">
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Karting" className={champ} />
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={champ} />
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-dim">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
          Visible dans le catalogue
        </label>
        <ChoixParcs valeur={parcIds} onChange={setParcIds} quoi="cette activité et ses produits" />
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" checked={sansValidation} onChange={(e) => setSansValidation(e.target.checked)} className="mt-0.5" />
          <span>
            Sans validation
            <span className="block text-[11px] text-dim">
              Les commandes de cette activité partent directement (sans ton accord) aux destinataires ci-dessous, toi en copie.
            </span>
          </span>
        </label>
        {sansValidation && <ChoixDestinataires valeur={destinataires} onChange={setDestinataires} />}
        {destinatairesManquants && <div className="text-[12px] text-amber">Choisis au moins un destinataire.</div>}
      </div>
      <BoutonsModale onClose={onClose} onSave={save} disabled={!nom.trim() || destinatairesManquants} pending={enregistrer.isPending} />
    </Modale>
  );
}

function ModaleProduit({
  initial,
  activites,
  onClose,
}: {
  initial: Partial<ProduitCommande>;
  activites: ActiviteCommande[];
  onClose: () => void;
}) {
  const enregistrer = useEnregistrerProduit();
  const toast = useToast();
  const [activiteId, setActiviteId] = useState(initial.activite_id ?? activites[0]?.id ?? '');
  const [nom, setNom] = useState(initial.nom ?? '');
  const [reference, setReference] = useState(initial.reference ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [unite, setUnite] = useState(initial.unite ?? 'unité');
  const [prix, setPrix] = useState(initial.prix_unitaire != null ? String(initial.prix_unitaire) : '');
  const [photoUrl, setPhotoUrl] = useState(initial.photo_url ?? '');
  const [pieceId, setPieceId] = useState(initial.piece_id ?? '');
  const [categorie, setCategorie] = useState(initial.categorie ?? '');
  const [sousCategorie, setSousCategorie] = useState(initial.sous_categorie ?? '');
  // Suggestions : catégories déjà utilisées dans l'activité choisie
  const { data: catalogue } = useCatalogueCommandes(true);
  const suggestions = useMemo(() => {
    const cats = new Set<string>();
    const sous = new Set<string>();
    for (const p of catalogue?.produits ?? []) {
      if (p.activite_id !== activiteId || !p.categorie) continue;
      cats.add(p.categorie);
      if (p.sous_categorie && p.categorie === categorie.trim()) sous.add(p.sous_categorie);
    }
    return { cats: [...cats].sort(), sous: [...sous].sort() };
  }, [catalogue, activiteId, categorie]);
  const { data: pieces } = usePiecesStockOptions();
  const [actif, setActif] = useState(initial.actif ?? true);
  const [parcIds, setParcIds] = useState<string[]>(initial.parc_ids ?? []);

  const prixNum = prix.trim() ? Number(prix.replace(',', '.')) : null;
  const prixInvalide = prixNum !== null && (Number.isNaN(prixNum) || prixNum < 0);

  const save = async () => {
    try {
      await enregistrer.mutateAsync({
        id: initial.id,
        activite_id: activiteId,
        nom: nom.trim(),
        reference: reference.trim() || null,
        description: description.trim() || null,
        unite: unite.trim() || 'unité',
        prix_unitaire: prixNum,
        photo_url: photoUrl.trim() || null,
        piece_id: pieceId || null,
        categorie: categorie.trim() || null,
        sous_categorie: (categorie.trim() && sousCategorie.trim()) || null,
        ordre: initial.ordre ?? 0,
        actif,
        parc_ids: parcIds,
      });
      toast.success('Produit enregistré');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modale titre={initial.id ? 'Modifier le produit' : 'Nouveau produit'} onClose={onClose}>
      <div className="grid gap-3.5">
        <Field label="Activité *">
          <select value={activiteId} onChange={(e) => setActiviteId(e.target.value)} className={champ}>
            {activites.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nom *">
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Pneu avant kart" className={champ} />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Catégorie">
            <input
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Ex : Requilleuse"
              list="suggestions-categories"
              className={champ}
            />
            <datalist id="suggestions-categories">
              {suggestions.cats.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Sous-catégorie">
            <input
              value={sousCategorie}
              onChange={(e) => setSousCategorie(e.target.value)}
              placeholder="Ex : Électrique"
              list="suggestions-sous-categories"
              disabled={!categorie.trim()}
              className={cn(champ, !categorie.trim() && 'opacity-40')}
            />
            <datalist id="suggestions-sous-categories">
              {suggestions.sous.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Référence">
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={champ} />
          </Field>
          <Field label="Unité">
            <input value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="unité, carton, litre…" className={champ} />
          </Field>
        </div>
        <Field label="Prix unitaire (€)">
          <input
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            inputMode="decimal"
            placeholder="Laisser vide si inconnu"
            className={cn(champ, prixInvalide && 'border-red')}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={cn(champ, 'resize-none')}
          />
        </Field>
        <Field label="Lien de la photo">
          <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" className={champ} />
        </Field>
        <Field label="Pièce du stock alimentée à la livraison">
          <select value={pieceId} onChange={(e) => setPieceId(e.target.value)} className={champ}>
            <option value="">Créer / retrouver automatiquement (même référence)</option>
            {(pieces ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.reference} · {p.nom} (stock : {p.stock_actuel})
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-dim">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
          Disponible à la commande
        </label>
        <ChoixParcs valeur={parcIds} onChange={setParcIds} quoi="ce produit" />
      </div>
      <BoutonsModale
        onClose={onClose}
        onSave={save}
        disabled={!nom.trim() || !activiteId || prixInvalide}
        pending={enregistrer.isPending}
      />
    </Modale>
  );
}
