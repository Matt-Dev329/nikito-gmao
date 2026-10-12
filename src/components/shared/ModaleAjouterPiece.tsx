import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { ChampQuantite } from '@/components/ui/ChampQuantite';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/ToastProvider';
import { useFormationFilter } from '@/hooks/useFormation';
import { usePiecesStockOptions, type PieceStockOption } from '@/hooks/queries/useStockOptions';
import { useCatalogueCommandes, type ProduitCommande } from '@/hooks/queries/useCommandes';

const EN_STOCK = '__stock__';
const SANS_CATEGORIE = 'Autres pièces';
const LIMITE_RECHERCHE = 80;

type Choix = { type: 'stock'; piece: PieceStockOption } | { type: 'catalogue'; produit: ProduitCommande };

/**
 * Choix d'une pièce utilisée pendant une réparation : pièces en stock, ou
 * catalogue complet rangé par activité › catégorie › sous-catégorie.
 */
export function ModaleAjouterPiece({
  onAjouter,
  onClose,
}: {
  onAjouter: (piece: PieceStockOption, quantite: number) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { estFormation } = useFormationFilter();
  const { data: pieces, isLoading: chargeStock } = usePiecesStockOptions();
  const { data: catalogue, isLoading: chargeCatalogue } = useCatalogueCommandes();
  const [recherche, setRecherche] = useState('');
  const [onglet, setOnglet] = useState<string | null>(null);
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  const [choix, setChoix] = useState<Choix | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [envoi, setEnvoi] = useState(false);

  // En mode formation : uniquement le stock de formation
  const activites = useMemo(() => (estFormation ? [] : catalogue?.activites ?? []), [catalogue, estFormation]);
  const produits = useMemo(() => (estFormation ? [] : catalogue?.produits ?? []), [catalogue, estFormation]);
  const nomActivite = useMemo(() => new Map(activites.map((a) => [a.id, a.nom])), [activites]);
  const stock = useMemo(() => (pieces ?? []).filter((p) => p.stock_actuel > 0 || estFormation), [pieces, estFormation]);

  const ongletActif = onglet ?? (stock.length > 0 ? EN_STOCK : activites[0]?.id ?? EN_STOCK);
  const q = recherche.trim().toLowerCase();

  // Recherche : tout le stock et tout le catalogue
  const resultats = useMemo(() => {
    if (!q) return null;
    const s = stock.filter((p) => `${p.reference} ${p.nom}`.toLowerCase().includes(q));
    const c = produits.filter((p) =>
      [p.nom, p.reference, p.categorie, p.sous_categorie, nomActivite.get(p.activite_id)].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
    return { stock: s.slice(0, LIMITE_RECHERCHE), catalogue: c.slice(0, LIMITE_RECHERCHE), total: s.length + c.length };
  }, [q, stock, produits, nomActivite]);

  // Activité choisie : catégorie › sous-catégorie › pièces
  const categories = useMemo(() => {
    if (ongletActif === EN_STOCK) return [];
    const m = new Map<string, Map<string, ProduitCommande[]>>();
    produits
      .filter((p) => p.activite_id === ongletActif)
      .forEach((p) => {
        const cat = p.categorie || SANS_CATEGORIE;
        const sous = p.sous_categorie || '';
        if (!m.has(cat)) m.set(cat, new Map());
        const ms = m.get(cat)!;
        ms.set(sous, [...(ms.get(sous) ?? []), p]);
      });
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
      .map(([cat, ms]) => ({
        cat,
        total: [...ms.values()].reduce((n, l) => n + l.length, 0),
        sous: [...ms.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr')),
      }));
  }, [produits, ongletActif]);

  const basculer = (cat: string) =>
    setOuvertes((s) => {
      const n = new Set(s);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });

  const ajouter = async () => {
    if (!choix) return;
    if (choix.type === 'stock') {
      onAjouter(choix.piece, quantite);
      return;
    }
    setEnvoi(true);
    const { data, error } = await supabase.rpc('piece_depuis_catalogue', { p_produit_id: choix.produit.id });
    setEnvoi(false);
    if (error || !data) {
      toast.error(`Pièce non ajoutée : ${error?.message ?? 'erreur inconnue'}`);
      return;
    }
    const enStock = (pieces ?? []).find((p) => p.id === data);
    onAjouter(
      enStock ?? { id: data as string, reference: choix.produit.reference ?? '', nom: choix.produit.nom, stock_actuel: 0 },
      quantite
    );
  };

  const ligneStock = (p: PieceStockOption) => (
    <button
      key={`s-${p.id}`}
      onClick={() => setChoix({ type: 'stock', piece: p })}
      className={cn(
        'text-left p-2.5 px-3.5 rounded-lg flex items-center gap-3 border',
        choix?.type === 'stock' && choix.piece.id === p.id ? 'bg-nikito-cyan/12 border-nikito-cyan/45' : 'bg-bg-deep border-transparent'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{p.nom}</div>
        <div className="text-[11px] text-dim font-mono">{p.reference}</div>
      </div>
      <div className={cn('text-[12px]', p.stock_actuel > 0 ? 'text-green' : 'text-red')}>stock : {p.stock_actuel}</div>
    </button>
  );

  const ligneCatalogue = (p: ProduitCommande, chemin?: string) => (
    <button
      key={`c-${p.id}`}
      onClick={() => setChoix({ type: 'catalogue', produit: p })}
      className={cn(
        'text-left p-2.5 px-3.5 rounded-lg flex items-center gap-3 border',
        choix?.type === 'catalogue' && choix.produit.id === p.id ? 'bg-nikito-cyan/12 border-nikito-cyan/45' : 'bg-bg-deep border-transparent'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium">{p.nom}</div>
        <div className="text-[11px] text-dim">
          {p.reference && <span className="font-mono">{p.reference}</span>}
          {p.reference && chemin ? ' · ' : ''}
          {chemin}
        </div>
      </div>
    </button>
  );

  const nomChoix = choix ? (choix.type === 'stock' ? choix.piece.nom : choix.produit.nom) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[560px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Pièces utilisées</div>
            <div className="text-[17px] font-semibold mt-0.5">Choisir une pièce</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une pièce (nom, référence, catégorie)…"
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px] mb-3"
        />

        {!q && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 shrink-0">
            {(stock.length > 0 || estFormation) && (
              <Pill variant="cyan" active={ongletActif === EN_STOCK} onClick={() => setOnglet(EN_STOCK)}>
                En stock <span className="opacity-60">· {stock.length}</span>
              </Pill>
            )}
            {activites.map((a) => (
              <Pill key={a.id} variant="cyan" active={ongletActif === a.id} onClick={() => setOnglet(a.id)}>
                {a.nom} <span className="opacity-60">· {produits.filter((p) => p.activite_id === a.id).length}</span>
              </Pill>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-[200px] flex flex-col gap-1.5 mb-4">
          {chargeStock || chargeCatalogue ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-bg-deep rounded-lg h-12 animate-pulse" />)
          ) : resultats ? (
            resultats.total === 0 ? (
              <div className="text-[12px] text-dim text-center py-6">Aucune pièce trouvée.</div>
            ) : (
              <>
                {resultats.stock.length > 0 && <div className="text-[11px] text-dim uppercase tracking-wider mt-1">En stock</div>}
                {resultats.stock.map(ligneStock)}
                {resultats.catalogue.length > 0 && <div className="text-[11px] text-dim uppercase tracking-wider mt-2">Catalogue</div>}
                {resultats.catalogue.map((p) =>
                  ligneCatalogue(p, [nomActivite.get(p.activite_id), p.categorie, p.sous_categorie].filter(Boolean).join(' › '))
                )}
                {resultats.total > resultats.stock.length + resultats.catalogue.length && (
                  <div className="text-[11px] text-faint text-center py-2">Affine la recherche pour voir plus de résultats.</div>
                )}
              </>
            )
          ) : ongletActif === EN_STOCK ? (
            stock.length === 0 ? (
              <div className="text-[12px] text-dim text-center py-6">Aucune pièce en stock.</div>
            ) : (
              stock.map(ligneStock)
            )
          ) : categories.length === 0 ? (
            <div className="text-[12px] text-dim text-center py-6">Aucune pièce pour cette activité.</div>
          ) : (
            categories.map(({ cat, total, sous }) => {
              const ouverte = ouvertes.has(cat) || categories.length === 1;
              return (
                <div key={cat} className="flex flex-col gap-1.5">
                  <button
                    onClick={() => basculer(cat)}
                    className="flex items-center justify-between bg-bg-deep/60 border border-white/[0.06] rounded-lg px-3.5 min-h-[44px] text-left"
                  >
                    <span className="text-[13px] font-semibold">{cat}</span>
                    <span className="text-[12px] text-dim">
                      {total} {ouverte ? '▾' : '▸'}
                    </span>
                  </button>
                  {ouverte &&
                    sous.map(([nomSous, liste]) => (
                      <div key={nomSous} className="flex flex-col gap-1.5 pl-2">
                        {nomSous && <div className="text-[11px] text-nikito-cyan uppercase tracking-wider mt-1">{nomSous}</div>}
                        {liste.map((p) => ligneCatalogue(p))}
                      </div>
                    ))}
                </div>
              );
            })
          )}
        </div>

        {nomChoix && <div className="text-[12px] text-dim mb-2 truncate">Choisie : <span className="text-text">{nomChoix}</span></div>}
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-dim uppercase tracking-wider">Quantité</label>
          <ChampQuantite
            valeur={quantite}
            onChange={setQuantite}
            className="w-20 bg-bg-deep border border-white/[0.08] rounded-[10px] p-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
          />
          <button
            onClick={ajouter}
            disabled={!choix || envoi}
            className={cn(
              'ml-auto bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!choix || envoi) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {envoi ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
        {choix?.type === 'stock' && quantite > choix.piece.stock_actuel && (
          <p className="text-amber text-[11px] mt-2">
            Attention : quantité supérieure au stock enregistré ({choix.piece.stock_actuel}).
          </p>
        )}
      </div>
    </div>
  );
}
