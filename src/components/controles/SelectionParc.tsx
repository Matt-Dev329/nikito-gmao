import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { Logo } from '@/components/ui/Logo';

interface SelectionParcProps {
  titre: string;
  onSelect: (parc: { id: string; code: string; nom: string }) => void;
}

function getStaffParcIds(): string[] {
  try {
    const raw = sessionStorage.getItem('staff_session');
    if (!raw) return [];
    const s = JSON.parse(raw);
    return s?.parc?.id ? [s.parc.id] : [];
  } catch { return []; }
}

export function SelectionParc({ titre, onSelect }: SelectionParcProps) {
  const navigate = useNavigate();
  const { utilisateur, signOut } = useAuth();
  const { data: allParcs, isLoading } = useParcs();

  const staffParcIds = getStaffParcIds();
  const role = utilisateur?.role_code;
  const parcIds = utilisateur?.parc_ids?.length ? utilisateur.parc_ids : staffParcIds;

  const parcsVisibles = useMemo(() => {
    if (!allParcs) return [];
    if (role === 'direction' || role === 'chef_maintenance') {
      return allParcs;
    }
    return allParcs.filter((p) => parcIds.includes(p.id));
  }, [allParcs, role, parcIds]);

  useEffect(() => {
    if (isLoading || !parcsVisibles.length) return;
    if (parcsVisibles.length === 1) {
      onSelect({ id: parcsVisibles[0].id, code: parcsVisibles[0].code, nom: parcsVisibles[0].nom });
    }
  }, [isLoading, parcsVisibles, onSelect]);

  const peutRetourGmao = role === 'direction' || role === 'chef_maintenance';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  if (parcsVisibles.length === 1) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-app text-text">
      <header className="px-[22px] py-[18px] bg-bg-sidebar flex items-center gap-3.5 border-b border-white/[0.06]">
        <Logo size="md" withText={false} />
        <div className="flex-1">
          <div className="text-[11px] text-dim tracking-[1.4px] uppercase">ALBA by Nikito</div>
          <div className="text-base font-semibold">{titre}</div>
        </div>
        <div className="flex items-center gap-2">
          {peutRetourGmao ? (
            <button
              onClick={() => navigate('/gmao')}
              className="text-[12px] text-dim hover:text-text transition-colors"
            >
              &lsaquo; Retour GMAO
            </button>
          ) : (
            <button
              onClick={() => {
                signOut();
                navigate('/');
              }}
              className="text-[12px] text-dim hover:text-text transition-colors"
            >
              Se deconnecter
            </button>
          )}
        </div>
      </header>

      <main className="p-8 px-6 max-w-[680px] mx-auto">
        <div className="text-[11px] text-dim uppercase tracking-wider text-center mb-5">
          Selectionner un parc
        </div>

        {parcsVisibles.length === 0 ? (
          <div className="text-center text-dim text-sm py-8">
            Aucun parc assigne. Contactez votre responsable.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {parcsVisibles.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect({ id: p.id, code: p.code, nom: p.nom })}
                className={`bg-bg-card border rounded-2xl p-6 px-[18px] text-left transition-colors ${
                  p.actif ? 'border-white/[0.08] hover:border-nikito-pink' : 'border-white/[0.04] opacity-60 hover:border-white/[0.12] hover:opacity-80'
                }`}
              >
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-lg font-bold font-mono text-nikito-cyan">{p.code}</span>
                  {!p.actif && <span className="text-[10px] text-dim bg-white/[0.06] px-2 py-0.5 rounded">Inactif</span>}
                </div>
                <div className="text-sm font-semibold mb-1">{p.nom}</div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
