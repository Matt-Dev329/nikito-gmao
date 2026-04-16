import { useNavigate } from 'react-router-dom';
import { useParcs } from '@/hooks/queries/useReferentiel';

export function ListeParcs() {
  const navigate = useNavigate();
  const { data: parcs, isLoading } = useParcs();

  return (
    <div className="p-6 px-7">
      <div className="flex justify-between items-start mb-[22px]">
        <div>
          <h1 className="text-[22px] font-semibold m-0">Parcs Nikito Group</h1>
          <div className="text-[13px] text-dim mt-1">
            {parcs?.length ?? 0} parc(s) actif(s) · gestion centralisée
          </div>
        </div>
        <button
          onClick={() => navigate('/gmao/parcs/nouveau')}
          className="bg-gradient-cta text-text px-4 py-2.5 rounded-lg text-[13px] font-bold"
        >
          + Créer un parc
        </button>
      </div>

      {isLoading ? (
        <div className="text-dim">Chargement...</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {parcs?.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/admin/parcs/${p.id}`)}
              className="bg-bg-card rounded-2xl p-5 cursor-pointer hover:bg-bg-deep transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-[11px] text-dim font-mono">{p.code}</div>
                  <div className="text-base font-semibold">{p.nom}</div>
                </div>
                {p.ouvert_7j7 && (
                  <span className="bg-amber/20 text-amber px-2.5 py-0.5 rounded-md text-[10px] font-bold">
                    7J/7
                  </span>
                )}
              </div>
              <div className="text-xs text-dim space-y-1">
                <div>{p.ville} ({p.code_postal})</div>
                <div>{p.surface_m2 ? `${p.surface_m2.toLocaleString('fr-FR')} m²` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
