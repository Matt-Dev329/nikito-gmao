import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useCategoriesEquipement } from '@/hooks/queries/useReferentiel';
import { useAjouterAttraction } from '@/hooks/queries/useAttractionsParc';

interface ModaleAjouterAttractionProps {
  parcId: string;
  categoriesDejaAjoutees: string[];
  onClose: () => void;
}

export function ModaleAjouterAttraction({
  parcId,
  categoriesDejaAjoutees,
  onClose,
}: ModaleAjouterAttractionProps) {
  const { data: categories, isLoading } = useCategoriesEquipement();
  const ajouter = useAjouterAttraction(parcId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [recherche, setRecherche] = useState('');

  const disponibles = (categories ?? []).filter(
    (c) =>
      !categoriesDejaAjoutees.includes((c as Record<string, unknown>).id as string) &&
      ((c as Record<string, unknown>).nom as string)
        .toLowerCase()
        .includes(recherche.toLowerCase())
  );

  const handleAjouter = async () => {
    if (!selectedId) return;
    await ajouter.mutateAsync({ categorieId: selectedId, quantite });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card rounded-t-2xl md:rounded-2xl w-full md:max-w-[480px] border border-white/[0.08] shadow-2xl flex flex-col max-h-[90vh] md:max-h-[80vh]">
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[17px] font-semibold">Ajouter une attraction</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-bg-deep border border-white/[0.08] text-dim text-sm"
            >
              x
            </button>
          </div>
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une catégorie..."
            className="w-full bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-bg-deep rounded-xl animate-pulse" />
              ))}
            </div>
          ) : disponibles.length === 0 ? (
            <div className="text-center py-8 text-dim text-sm">
              {recherche
                ? 'Aucune catégorie trouvée'
                : 'Toutes les catégories sont déjà configurées'}
            </div>
          ) : (
            disponibles.map((cat) => {
              const c = cat as Record<string, unknown>;
              const id = c.id as string;
              const nom = c.nom as string;
              const crit = c.criticite_defaut as string;
              const isSelected = selectedId === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedId(isSelected ? null : id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors',
                    isSelected
                      ? 'bg-gradient-active border border-nikito-pink/30'
                      : 'bg-bg-deep border border-white/[0.06] hover:border-white/[0.12]'
                  )}
                >
                  <span className="text-[13px] font-medium flex-1">{nom}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                      crit === 'bloquant' && 'bg-red/15 text-red',
                      crit === 'majeur' && 'bg-amber/15 text-amber',
                      crit === 'mineur' && 'bg-green/15 text-green'
                    )}
                  >
                    {crit}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 md:px-6 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3 md:mb-0 md:inline-flex">
            <span className="text-[12px] text-dim">Quantité</span>
            <button
              onClick={() => setQuantite((q) => Math.max(1, q - 1))}
              className="min-w-[44px] min-h-[44px] md:w-8 md:h-8 md:min-w-0 md:min-h-0 rounded-lg bg-bg-deep border border-white/[0.08] text-dim text-sm flex items-center justify-center"
            >
              -
            </button>
            <span className="w-8 text-center text-sm font-mono font-semibold">{quantite}</span>
            <button
              onClick={() => setQuantite((q) => q + 1)}
              className="min-w-[44px] min-h-[44px] md:w-8 md:h-8 md:min-w-0 md:min-h-0 rounded-lg bg-bg-deep border border-white/[0.08] text-dim text-sm flex items-center justify-center"
            >
              +
            </button>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-[13px] text-dim bg-bg-deep border border-white/[0.08] min-h-[44px]"
            >
              Annuler
            </button>
            <button
              onClick={handleAjouter}
              disabled={!selectedId || ajouter.isPending}
              className={cn(
                'flex-1 md:flex-none px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-opacity min-h-[44px]',
                selectedId ? 'bg-gradient-cta text-text' : 'bg-bg-deep text-faint cursor-not-allowed'
              )}
            >
              {ajouter.isPending ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
