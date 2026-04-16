import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useParc } from '@/hooks/queries/useReferentiel';
import {
  usePointsPourParcEtCategorie,
  useTogglePointActif,
  type PointApplicable,
} from '@/hooks/queries/usePointsCategoriePourParc';

type FiltreType = 'tous' | 'quotidien' | 'hebdo' | 'mensuel';

const filtreLabels: Record<FiltreType, string> = {
  tous: 'Tous',
  quotidien: 'Quotidien',
  hebdo: 'Hebdo',
  mensuel: 'Mensuel',
};

export function PersonnaliserPointsParc() {
  const { id: parcId, categorieId } = useParams<{ id: string; categorieId: string }>();
  const navigate = useNavigate();
  const { data: parc } = useParc(parcId);
  const { data: points, isLoading } = usePointsPourParcEtCategorie(parcId, categorieId);
  const toggle = useTogglePointActif(parcId!);
  const [filtre, setFiltre] = useState<FiltreType>('tous');

  const categorieNom = points?.[0]?.categorie_nom ?? '...';

  const pointsFiltres = useMemo(() => {
    if (!points) return [];
    if (filtre === 'tous') return points;
    return points.filter((p) => p.type_controle === filtre);
  }, [points, filtre]);

  const stats = useMemo(() => {
    if (!points) return { total: 0, actifs: 0, bloquants: 0 };
    return {
      total: points.length,
      actifs: points.filter((p) => p.actif_pour_parc).length,
      bloquants: points.filter((p) => p.bloquant && p.actif_pour_parc).length,
    };
  }, [points]);

  const groupes = useMemo(() => {
    const map = new Map<string, PointApplicable[]>();
    for (const p of pointsFiltres) {
      const key = p.type_controle;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [pointsFiltres]);

  const handleToggle = (pointId: string, currentActif: boolean) => {
    toggle.mutate({ pointId, actif: currentActif });
  };

  return (
    <div>
      <header className="bg-bg-card border-b border-white/[0.06] px-4 md:px-7 pt-4 md:pt-5 pb-4 md:pb-5">
        <button
          onClick={() => navigate(`/gmao/parcs/${parcId}/attractions`)}
          className="md:hidden flex items-center gap-1.5 text-[13px] text-dim min-h-[44px] mb-1"
        >
          <span>&#8592;</span> Attractions
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
          <button onClick={() => navigate(`/gmao/parcs/${parcId}/attractions`)} className="hover:text-nikito-cyan">
            Attractions
          </button>
          <span>&#8250;</span>
          <span className="text-nikito-cyan">{categorieNom}</span>
        </div>
        <h1 className="text-xl md:text-[22px] font-semibold m-0 mb-2">
          Points de contrôle · {categorieNom}
        </h1>

        <div className="flex items-center gap-4 md:gap-6 text-[12px]">
          <span className="text-dim">
            <span className="text-text font-semibold">{stats.actifs}</span>/{stats.total} actifs
          </span>
          <span className="text-dim">
            <span className="text-red font-semibold">{stats.bloquants}</span> bloquants
          </span>
        </div>

        <div className="flex gap-1.5 mt-4 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          {(Object.keys(filtreLabels) as FiltreType[]).map((f) => {
            const count =
              f === 'tous'
                ? points?.length ?? 0
                : points?.filter((p) => p.type_controle === f).length ?? 0;
            return (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-[12px] transition-colors whitespace-nowrap min-h-[44px] md:min-h-0',
                  filtre === f
                    ? 'bg-nikito-cyan text-text font-semibold'
                    : 'bg-bg-deep text-dim border border-white/[0.06]'
                )}
              >
                {filtreLabels[f]} ({count})
              </button>
            );
          })}
        </div>
      </header>

      <div className="p-4 md:p-7">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-bg-card rounded-xl h-16 animate-pulse" />
            ))}
          </div>
        ) : pointsFiltres.length === 0 ? (
          <div className="text-center py-16 text-dim text-sm">
            Aucun point trouvé pour ce filtre
          </div>
        ) : (
          Array.from(groupes.entries()).map(([typeControle, pts]) => (
            <div key={typeControle} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase',
                    typeControle === 'quotidien' && 'bg-nikito-cyan/15 text-nikito-cyan',
                    typeControle === 'hebdo' && 'bg-nikito-pink/15 text-nikito-pink',
                    typeControle === 'mensuel' && 'bg-amber/15 text-amber'
                  )}
                >
                  {typeControle}
                </span>
                <span className="text-[11px] text-dim">{pts.length} points</span>
              </div>

              <div className="flex flex-col gap-2">
                {pts.map((p) => (
                  <div
                    key={p.point_id}
                    className={cn(
                      'bg-bg-card rounded-xl p-3 px-4 md:p-3.5 md:px-5 border flex items-center gap-3 md:gap-4 transition-opacity',
                      p.actif_pour_parc
                        ? 'border-white/[0.06]'
                        : 'border-white/[0.04] opacity-50'
                    )}
                  >
                    <button
                      onClick={() => handleToggle(p.point_id, p.actif_pour_parc)}
                      disabled={toggle.isPending}
                      className={cn(
                        'w-11 h-7 md:w-10 md:h-6 rounded-full relative transition-colors flex-shrink-0',
                        p.actif_pour_parc ? 'bg-green' : 'bg-faint/40'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-5 h-5 rounded-full bg-text transition-transform',
                          p.actif_pour_parc ? 'left-[18px]' : 'left-0.5'
                        )}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{p.point_libelle}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.bloquant && (
                          <span className="text-[10px] font-bold text-red uppercase">bloquant</span>
                        )}
                        {p.photo_obligatoire && (
                          <span className="text-[10px] text-dim">photo obligatoire</span>
                        )}
                        {p.assigne_a && (
                          <span className="text-[10px] text-dim">assigné {p.assigne_a}</span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] text-faint font-mono flex-shrink-0">
                      #{p.ordre ?? '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
