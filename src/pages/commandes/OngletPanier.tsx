import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useParcCourant } from '@/hooks/useParcCourant';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useToast } from '@/components/ui/ToastProvider';
import { usePanier } from '@/hooks/usePanier';
import { useCatalogueCommandes, usePasserCommande } from '@/hooks/queries/useCommandes';
import { Quantite } from './OngletCatalogue';
import { formatPrix } from './format';

const ROLES_MULTI_PARCS = ['direction', 'chef_maintenance', 'directeur_parc', 'admin_it'];

export function OngletPanier({
  onRetourCatalogue,
  onEnvoyee,
}: {
  onRetourCatalogue: () => void;
  onEnvoyee: () => void;
}) {
  const { utilisateur } = useAuth();
  const toast = useToast();
  const parcCourant = useParcCourant((s) => s.parc);
  const { data: catalogue } = useCatalogueCommandes();
  const { data: tousParcs } = useParcs();
  const { lignes, definir, retirer, vider } = usePanier();
  const passer = usePasserCommande();

  const parcs = useMemo(() => {
    const raw = (tousParcs ?? []) as Array<{ id: string; code: string; nom: string }>;
    if (utilisateur && ROLES_MULTI_PARCS.includes(utilisateur.role_code)) return raw;
    return raw.filter((p) => utilisateur?.parc_ids.includes(p.id));
  }, [tousParcs, utilisateur]);

  const [parcChoisi, setParcChoisi] = useState<string>('');
  const parcId = parcChoisi || (parcCourant && parcs.some((p) => p.id === parcCourant.id) ? parcCourant.id : parcs[0]?.id) || '';
  const [commentaire, setCommentaire] = useState('');

  const items = useMemo(() => {
    const produits = new Map((catalogue?.produits ?? []).map((p) => [p.id, p]));
    const activites = new Map((catalogue?.activites ?? []).map((a) => [a.id, a.nom]));
    return Object.entries(lignes).map(([id, quantite]) => {
      const produit = produits.get(id);
      return { id, quantite, produit, activite: produit ? activites.get(produit.activite_id) : undefined };
    });
  }, [lignes, catalogue]);

  const indisponibles = items.filter((i) => !i.produit);
  const total = items.reduce((s, i) => s + (i.produit?.prix_unitaire ?? 0) * i.quantite, 0);
  const prixManquant = items.some((i) => i.produit && i.produit.prix_unitaire == null);

  const envoyer = async () => {
    if (!parcId) {
      toast.error('Choisis le parc concerné par la commande.');
      return;
    }
    try {
      const res = await passer.mutateAsync({
        parcId,
        commentaire: commentaire.trim(),
        lignes: items.filter((i) => i.produit).map((i) => ({ produit_id: i.id, quantite: i.quantite })),
      });
      vider();
      setCommentaire('');
      toast.success(`Commande ${res.numero} envoyée`);
      onEnvoyee();
    } catch (e) {
      toast.error(`Envoi impossible : ${(e as Error).message}`);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-dim text-sm">Ton panier est vide.</p>
        <button onClick={onRetourCatalogue} className="mt-3 text-nikito-cyan text-[13px] font-medium hover:underline">
          Parcourir le catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px] items-start">
      <div className="bg-bg-card rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              {i.produit ? (
                <>
                  <div className="text-[14px] font-medium">{i.produit.nom}</div>
                  <div className="text-[11px] text-dim">
                    {[i.activite, i.produit.reference, `${formatPrix(i.produit.prix_unitaire)} / ${i.produit.unite}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </>
              ) : (
                <div className="text-[13px] text-faint">Produit retiré du catalogue</div>
              )}
            </div>
            {i.produit && <Quantite valeur={i.quantite} onChange={(q) => definir(i.id, q)} />}
            <button
              onClick={() => retirer(i.id)}
              className="text-red text-[12px] px-2 min-h-[36px] hover:underline"
              aria-label="Retirer du panier"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>

      <div className="bg-bg-card rounded-xl border border-nikito-cyan/15 p-4 md:p-5 lg:sticky lg:top-4">
        <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">Parc concerné</label>
        <select
          value={parcId}
          onChange={(e) => setParcChoisi(e.target.value)}
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] mb-4"
        >
          {parcs.length === 0 && <option value="">Aucun parc disponible</option>}
          {parcs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.nom}
            </option>
          ))}
        </select>

        <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">Commentaire (facultatif)</label>
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          rows={3}
          placeholder="Urgence, précision, lieu de livraison..."
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan mb-4 resize-none"
        />

        <div className="flex justify-between items-baseline mb-1">
          <span className="text-dim text-[13px]">Total estimé</span>
          <span className="text-[18px] font-semibold">{formatPrix(total)}</span>
        </div>
        {prixManquant && <p className="text-faint text-[11px] mb-2">Certains produits n'ont pas encore de prix.</p>}
        {indisponibles.length > 0 && (
          <p className="text-amber text-[11px] mb-2">
            {indisponibles.length} produit(s) ne sont plus au catalogue et ne seront pas commandés.
          </p>
        )}

        <button
          onClick={envoyer}
          disabled={passer.isPending || !parcId || items.every((i) => !i.produit)}
          className={cn(
            'w-full mt-3 bg-gradient-cta text-text px-5 py-3 rounded-[10px] text-[14px] font-bold min-h-[48px]',
            (passer.isPending || !parcId) && 'opacity-40 cursor-not-allowed'
          )}
        >
          {passer.isPending ? 'Envoi…' : 'Envoyer la commande'}
        </button>
        <button onClick={vider} className="w-full mt-2 text-dim text-[12px] min-h-[40px] hover:text-text">
          Vider le panier
        </button>
      </div>
    </div>
  );
}
