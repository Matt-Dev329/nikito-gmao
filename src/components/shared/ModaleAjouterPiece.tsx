import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { usePiecesStockOptions, type PieceStockOption } from '@/hooks/queries/useStockOptions';

/** Choix d'une pièce du stock + quantité (pièces utilisées pendant une réparation). */
export function ModaleAjouterPiece({
  onAjouter,
  onClose,
}: {
  onAjouter: (piece: PieceStockOption, quantite: number) => void;
  onClose: () => void;
}) {
  const { data: pieces, isLoading } = usePiecesStockOptions();
  const [recherche, setRecherche] = useState('');
  const [choisie, setChoisie] = useState<PieceStockOption | null>(null);
  const [quantite, setQuantite] = useState(1);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const all = pieces ?? [];
    return q ? all.filter((p) => `${p.reference} ${p.nom}`.toLowerCase().includes(q)) : all;
  }, [pieces, recherche]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[480px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Pièces utilisées</div>
            <div className="text-[17px] font-semibold mt-0.5">Ajouter une pièce du stock</div>
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
          placeholder="Rechercher (référence, nom)..."
          autoFocus
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px] mb-3"
        />

        <div className="flex-1 overflow-y-auto min-h-[160px] flex flex-col gap-1.5 mb-4">
          {isLoading ? (
            <div className="bg-bg-deep rounded-lg h-12 animate-pulse" />
          ) : filtrees.length === 0 ? (
            <div className="text-[12px] text-dim text-center py-6">Aucune pièce trouvée dans le stock.</div>
          ) : (
            filtrees.map((p) => (
              <button
                key={p.id}
                onClick={() => setChoisie(p)}
                className={cn(
                  'text-left p-2.5 px-3.5 rounded-lg flex items-center gap-3 border',
                  choisie?.id === p.id ? 'bg-nikito-cyan/12 border-nikito-cyan/45' : 'bg-bg-deep border-transparent'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{p.nom}</div>
                  <div className="text-[11px] text-dim font-mono">{p.reference}</div>
                </div>
                <div className={cn('text-[12px]', p.stock_actuel > 0 ? 'text-dim' : 'text-red')}>
                  stock : {p.stock_actuel}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-[11px] text-dim uppercase tracking-wider">Quantité</label>
          <input
            type="number"
            min={1}
            value={quantite}
            onChange={(e) => setQuantite(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 bg-bg-deep border border-white/[0.08] rounded-[10px] p-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
          />
          <button
            onClick={() => choisie && onAjouter(choisie, quantite)}
            disabled={!choisie}
            className={cn(
              'ml-auto bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              !choisie && 'opacity-40 cursor-not-allowed'
            )}
          >
            Ajouter
          </button>
        </div>
        {choisie && quantite > choisie.stock_actuel && (
          <p className="text-amber text-[11px] mt-2">
            Attention : quantité supérieure au stock enregistré ({choisie.stock_actuel}).
          </p>
        )}
      </div>
    </div>
  );
}
