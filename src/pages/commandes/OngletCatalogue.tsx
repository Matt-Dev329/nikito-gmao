import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/ui/Pill';
import { usePanier, nombreArticles } from '@/hooks/usePanier';
import { useCatalogueCommandes, type ProduitCommande } from '@/hooks/queries/useCommandes';
import { formatPrix } from './format';

const PAR_PAGE = 60;

export function OngletCatalogue({ onVoirPanier }: { onVoirPanier: () => void }) {
  const { data, isLoading, isError, error } = useCatalogueCommandes();
  const lignes = usePanier((s) => s.lignes);
  const [activiteId, setActiviteIdBrut] = useState<string | null>(null);
  const [categorie, setCategorieBrut] = useState<string | null>(null);
  const [sousCategorie, setSousCategorieBrut] = useState<string | null>(null);
  const [recherche, setRechercheBrut] = useState('');
  const [nbAffiches, setNbAffiches] = useState(PAR_PAGE);

  // Changer un filtre réinitialise les filtres plus fins et la pagination
  const setActiviteId = (id: string | null) => {
    setActiviteIdBrut(id);
    setCategorieBrut(null);
    setSousCategorieBrut(null);
    setNbAffiches(PAR_PAGE);
  };
  const setCategorie = (c: string | null) => {
    setCategorieBrut(c);
    setSousCategorieBrut(null);
    setNbAffiches(PAR_PAGE);
  };
  const setSousCategorie = (s: string | null) => {
    setSousCategorieBrut(s);
    setNbAffiches(PAR_PAGE);
  };
  const setRecherche = (r: string) => {
    setRechercheBrut(r);
    setNbAffiches(PAR_PAGE);
  };

  const produitsActivite = useMemo(
    () => (data?.produits ?? []).filter((p) => !activiteId || p.activite_id === activiteId),
    [data, activiteId]
  );

  // Catégories (et sous-catégories) présentes dans l'activité choisie, avec leur nombre de produits
  const categories = useMemo(() => {
    if (!activiteId) return [];
    const m = new Map<string, number>();
    produitsActivite.forEach((p) => p.categorie && m.set(p.categorie, (m.get(p.categorie) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [activiteId, produitsActivite]);

  const sousCategories = useMemo(() => {
    if (!categorie) return [];
    const m = new Map<string, number>();
    produitsActivite.forEach(
      (p) => p.categorie === categorie && p.sous_categorie && m.set(p.sous_categorie, (m.get(p.sous_categorie) ?? 0) + 1)
    );
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [categorie, produitsActivite]);

  const produits = useMemo(() => {
    let res = produitsActivite;
    if (categorie) res = res.filter((p) => p.categorie === categorie);
    if (sousCategorie) res = res.filter((p) => p.sous_categorie === sousCategorie);
    const q = recherche.trim().toLowerCase();
    if (q) {
      res = res.filter((p) =>
        [p.nom, p.reference, p.description, p.categorie, p.sous_categorie].filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }
    return res;
  }, [produitsActivite, categorie, sousCategorie, recherche]);

  // Les activités sans produit restent proposées en commande spécifique mais pas ici
  const activitesAvecProduits = useMemo(() => {
    const ids = new Set((data?.produits ?? []).map((p) => p.activite_id));
    return (data?.activites ?? []).filter((a) => ids.has(a.id));
  }, [data]);

  const nomActivite = useMemo(() => {
    const m = new Map<string, string>();
    data?.activites.forEach((a) => m.set(a.id, a.nom));
    return m;
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-bg-card rounded-xl h-32 animate-pulse" />
        ))}
      </div>
    );
  }
  if (isError) {
    return <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>;
  }
  if (!data || activitesAvecProduits.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-dim text-sm">Le catalogue est vide pour l'instant.</p>
        <p className="text-faint text-[12px] mt-1">Les activités et produits sont ajoutés depuis « Gérer le catalogue ».</p>
      </div>
    );
  }

  const nbPanier = nombreArticles(lignes);

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un produit (nom, référence)..."
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Pill active={activiteId === null} onClick={() => setActiviteId(null)}>
            Toutes les activités
          </Pill>
          {activitesAvecProduits.map((a) => (
            <Pill key={a.id} active={activiteId === a.id} onClick={() => setActiviteId(a.id)}>
              {a.nom}
            </Pill>
          ))}
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={categorie === null} onClick={() => setCategorie(null)}>
              Toutes les catégories
            </Pill>
            {categories.map(([c, n]) => (
              <Pill key={c} variant="cyan" active={categorie === c} onClick={() => setCategorie(c)}>
                {c} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
        {sousCategories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill active={sousCategorie === null} onClick={() => setSousCategorie(null)} className="min-h-[32px] py-1.5">
              Tout
            </Pill>
            {sousCategories.map(([s, n]) => (
              <Pill key={s} active={sousCategorie === s} onClick={() => setSousCategorie(s)} className="min-h-[32px] py-1.5">
                {s} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      {produits.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm">Aucun produit trouvé.</p>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-faint mb-2">
            {produits.length} produit{produits.length > 1 ? 's' : ''}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {produits.slice(0, nbAffiches).map((p) => (
              <CarteProduit key={p.id} produit={p} activite={nomActivite.get(p.activite_id)} quantite={lignes[p.id] ?? 0} />
            ))}
          </div>
          {produits.length > nbAffiches && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setNbAffiches((n) => n + PAR_PAGE)}
                className="bg-bg-card border border-white/[0.08] text-dim hover:text-text px-5 py-2.5 rounded-[10px] text-[13px] min-h-[44px]"
              >
                Afficher plus ({produits.length - nbAffiches} restants)
              </button>
            </div>
          )}
        </>
      )}

      {nbPanier > 0 && (
        <div className="sticky bottom-4 mt-5 flex justify-center">
          <button
            onClick={onVoirPanier}
            className="bg-gradient-cta text-text px-6 py-3 rounded-pill text-[14px] font-bold min-h-[48px] shadow-lg"
          >
            Voir le panier · {nbPanier} article{nbPanier > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function CarteProduit({ produit, activite, quantite }: { produit: ProduitCommande; activite?: string; quantite: number }) {
  const ajouter = usePanier((s) => s.ajouter);
  const definir = usePanier((s) => s.definir);

  return (
    <div
      className={cn(
        'bg-bg-card rounded-xl border p-4 flex gap-3',
        quantite > 0 ? 'border-nikito-cyan/40' : 'border-white/[0.06]'
      )}
    >
      {produit.photo_url ? (
        <img
          src={produit.photo_url}
          alt=""
          loading="lazy"
          className="w-16 h-16 rounded-lg object-cover bg-bg-deep flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-bg-deep flex-shrink-0 flex items-center justify-center text-faint text-[10px] uppercase">
          {activite?.slice(0, 3) ?? '—'}
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="text-[14px] font-semibold leading-tight">{produit.nom}</div>
        <div className="text-[11px] text-dim mt-0.5 truncate">
          {[activite, produit.sous_categorie ?? produit.categorie, produit.reference].filter(Boolean).join(' · ')}
        </div>
        {produit.description && <div className="text-[12px] text-faint mt-1 line-clamp-2">{produit.description}</div>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="text-[13px] text-text">
            {formatPrix(produit.prix_unitaire)}
            <span className="text-faint text-[11px]"> / {produit.unite}</span>
          </span>
          {quantite === 0 ? (
            <button
              onClick={() => ajouter(produit.id)}
              className="bg-nikito-cyan/12 border border-nikito-cyan/45 text-nikito-cyan px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px]"
            >
              + Ajouter
            </button>
          ) : (
            <Quantite valeur={quantite} onChange={(q) => definir(produit.id, q)} />
          )}
        </div>
      </div>
    </div>
  );
}

export function Quantite({ valeur, onChange }: { valeur: number; onChange: (q: number) => void }) {
  return (
    <div className="flex items-center bg-bg-deep border border-white/[0.08] rounded-lg">
      <button
        onClick={() => onChange(valeur - 1)}
        className="w-9 h-9 text-dim text-base"
        aria-label="Diminuer la quantité"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        value={valeur}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-10 bg-transparent text-center text-[13px] text-text outline-none [appearance:textfield]"
        aria-label="Quantité"
      />
      <button
        onClick={() => onChange(valeur + 1)}
        className="w-9 h-9 text-nikito-cyan text-base"
        aria-label="Augmenter la quantité"
      >
        +
      </button>
    </div>
  );
}
