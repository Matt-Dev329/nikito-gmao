import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useParc } from '@/hooks/queries/useReferentiel';
import {
  useAttractionsParc,
  useSupprimerAttraction,
  useModifierQuantiteAttraction,
} from '@/hooks/queries/useAttractionsParc';
import { usePointsPourParc } from '@/hooks/queries/usePointsCategoriePourParc';
import { ModaleAjouterAttraction } from '@/components/parc/ModaleAjouterAttraction';

export function AttractionsParc() {
  const { id: parcId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: parc } = useParc(parcId);
  const { data: attractions, isLoading } = useAttractionsParc(parcId);
  const { data: points } = usePointsPourParc(parcId);
  const supprimer = useSupprimerAttraction(parcId!);
  const modifierQte = useModifierQuantiteAttraction(parcId!);
  const [showAjouter, setShowAjouter] = useState(false);
  const [confirmSuppr, setConfirmSuppr] = useState<string | null>(null);

  const pointsParCategorie = (categorieId: string) => {
    if (!points) return { total: 0, actifs: 0 };
    const pts = points.filter((p) => p.categorie_id === categorieId);
    return { total: pts.length, actifs: pts.filter((p) => p.actif_pour_parc).length };
  };

  const handleSupprimer = async (attractionId: string) => {
    await supprimer.mutateAsync(attractionId);
    setConfirmSuppr(null);
  };

  const categoriesDejaAjoutees = (attractions ?? []).map((a) => a.categorie_id);

  return (
    <div>
      <header className="bg-bg-card border-b border-white/[0.06] px-4 md:px-7 pt-4 md:pt-5 pb-4 md:pb-5">
        <button
          onClick={() => navigate(`/gmao/parcs/${parcId}`)}
          className="md:hidden flex items-center gap-1.5 text-[13px] text-dim min-h-[44px] mb-1"
        >
          &#8592; {parc?.code ?? 'Parc'}
        </button>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-dim mb-1">
          <button onClick={() => navigate('/gmao/parcs')} className="hover:text-nikito-cyan">
            Parcs
          </button>
          <span>&#8250;</span>
          <button onClick={() => navigate(`/gmao/parcs/${parcId}`)} className="hover:text-nikito-cyan">
            {parc?.code ?? '...'}
          </button>
          <span>&#8250;</span>
          <span className="text-nikito-cyan">Attractions</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-[22px] font-semibold m-0">
              Attractions {parc?.code ? `· ${parc.code}` : ''}
            </h1>
            <p className="text-[13px] text-dim mt-1">
              {attractions?.length ?? 0} catégorie{(attractions?.length ?? 0) > 1 ? 's' : ''} configurée{(attractions?.length ?? 0) > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowAjouter(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] w-full sm:w-auto"
          >
            + Ajouter
          </button>
        </div>
      </header>

      <div className="p-4 md:p-7">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : !attractions || attractions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-dim text-sm">Aucune attraction configurée pour ce parc</p>
            <button
              onClick={() => setShowAjouter(true)}
              className="mt-4 bg-gradient-cta text-text px-5 py-2.5 rounded-xl text-[13px] font-semibold"
            >
              Ajouter la première attraction
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {attractions.map((a: any) => {
              const cat = a.categorie;
              const pts = pointsParCategorie(a.categorie_id);
              const isConfirm = confirmSuppr === a.id;

              return (
                <div
                  key={a.id}
                  className="bg-bg-card rounded-xl p-3 px-4 md:p-4 md:px-5 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-[15px] font-semibold">{cat?.nom ?? '—'}</span>
                      {cat?.criticite_defaut && (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                            cat.criticite_defaut === 'bloquant' && 'bg-red/15 text-red',
                            cat.criticite_defaut === 'majeur' && 'bg-amber/15 text-amber',
                            cat.criticite_defaut === 'mineur' && 'bg-green/15 text-green'
                          )}
                        >
                          {cat.criticite_defaut}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[12px] text-dim">
                      <span>{pts.actifs}/{pts.total} points actifs</span>
                      <Link
                        to={`/gmao/parcs/${parcId}/points/${a.categorie_id}`}
                        className="text-nikito-cyan hover:underline"
                      >
                        Personnaliser les points
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-2 sm:ml-auto">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (a.quantite > 1) {
                            modifierQte.mutate({ attractionId: a.id, quantite: a.quantite - 1 });
                          }
                        }}
                        className="min-w-[44px] min-h-[44px] md:w-8 md:h-8 md:min-w-0 md:min-h-0 rounded-lg bg-bg-deep border border-white/[0.08] text-dim text-sm flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-mono font-semibold">{a.quantite}</span>
                      <button
                        onClick={() => modifierQte.mutate({ attractionId: a.id, quantite: a.quantite + 1 })}
                        className="min-w-[44px] min-h-[44px] md:w-8 md:h-8 md:min-w-0 md:min-h-0 rounded-lg bg-bg-deep border border-white/[0.08] text-dim text-sm flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex-shrink-0">
                      {isConfirm ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleSupprimer(a.id)}
                            disabled={supprimer.isPending}
                            className="px-3 py-2 rounded-lg bg-red/15 text-red text-[11px] font-semibold min-h-[44px]"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setConfirmSuppr(null)}
                            className="px-3 py-2 rounded-lg bg-bg-deep text-dim text-[11px] min-h-[44px]"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmSuppr(a.id)}
                          className="min-w-[44px] min-h-[44px] md:w-8 md:h-8 md:min-w-0 md:min-h-0 rounded-lg bg-bg-deep border border-white/[0.08] text-red/60 hover:text-red text-sm transition-colors flex items-center justify-center"
                        >
                          x
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAjouter && parcId && (
        <ModaleAjouterAttraction
          parcId={parcId}
          categoriesDejaAjoutees={categoriesDejaAjoutees}
          onClose={() => setShowAjouter(false)}
        />
      )}
    </div>
  );
}
