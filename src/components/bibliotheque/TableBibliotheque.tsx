import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PointBibliothequeAvecJoins, TypeControle } from '@/types/database';

const TYPE_CONFIG: Record<TypeControle, { label: string; classes: string }> = {
  quotidien: { label: 'Quotidien', classes: 'bg-green/15 text-green' },
  hebdo: { label: 'Hebdo', classes: 'bg-amber/15 text-amber' },
  mensuel: { label: 'Mensuel', classes: 'bg-nikito-pink/15 text-nikito-pink' },
};

const ASSIGNE_LABEL: Record<string, string> = {
  staff: 'Staff',
  tech: 'Technicien',
};

interface TableBibliothequeProps {
  points: PointBibliothequeAvecJoins[];
  onSelect: (p: PointBibliothequeAvecJoins) => void;
  onCreer: () => void;
}

interface Groupe {
  categorieId: string;
  categorieNom: string;
  points: PointBibliothequeAvecJoins[];
}

export function TableBibliotheque({ points, onSelect, onCreer }: TableBibliothequeProps) {
  const groupes = useMemo(() => {
    const map = new Map<string, Groupe>();
    for (const p of points) {
      const catId = p.categorie_id;
      const catNom = p.categories_equipement?.nom ?? 'Sans categorie';
      if (!map.has(catId)) {
        map.set(catId, { categorieId: catId, categorieNom: catNom, points: [] });
      }
      map.get(catId)!.points.push(p);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => a.categorieNom.localeCompare(b.categorieNom));
    for (const g of arr) {
      g.points.sort((a, b) => a.ordre - b.ordre);
    }
    return arr;
  }, [points]);

  if (points.length === 0) {
    return <EmptyState onCreer={onCreer} />;
  }

  return (
    <div>
      <div className="hidden md:block">
        {groupes.map((g) => (
          <div key={g.categorieId} className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-[11px] text-dim uppercase tracking-[1.2px] font-medium">{g.categorieNom}</span>
              <span className="text-[10px] text-faint">({g.points.length})</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-[10px] text-dim uppercase tracking-wider font-medium py-2 px-2 w-12">#</th>
                  <th className="text-[10px] text-dim uppercase tracking-wider font-medium py-2 px-2">Libelle</th>
                  <th className="text-[10px] text-dim uppercase tracking-wider font-medium py-2 px-2 w-[90px]">Type</th>
                  <th className="text-[10px] text-dim uppercase tracking-wider font-medium py-2 px-2 w-[100px]">Assigne</th>
                  <th className="text-[10px] text-dim uppercase tracking-wider font-medium py-2 px-2 w-16 text-center">Bloq.</th>
                  <th className="text-[10px] text-dim uppercase tracking-wider font-medium py-2 px-2 w-16 text-center">Photo</th>
                  <th className="text-[10px] text-dim uppercase tracking-wider font-medium py-2 px-2 w-[120px]">Norme</th>
                  <th className="text-[10px] text-dim uppercase tracking-wider font-medium py-2 px-2 w-14 text-center">Actif</th>
                </tr>
              </thead>
              <tbody>
                {g.points.map((p) => (
                  <DesktopRow key={p.id} point={p} onSelect={() => onSelect(p)} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="md:hidden flex flex-col gap-2">
        {groupes.map((g) => (
          <div key={g.categorieId}>
            <div className="flex items-center gap-2 mb-2 mt-3 first:mt-0">
              <span className="text-[11px] text-dim uppercase tracking-[1.2px] font-medium">{g.categorieNom}</span>
              <span className="text-[10px] text-faint">({g.points.length})</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            {g.points.map((p) => (
              <MobileCard key={p.id} point={p} onSelect={() => onSelect(p)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopRow({ point: p, onSelect }: { point: PointBibliothequeAvecJoins; onSelect: () => void }) {
  const typeCfg = TYPE_CONFIG[p.type_controle];
  return (
    <tr
      onClick={onSelect}
      className={cn(
        'border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors',
        !p.actif && 'opacity-40'
      )}
    >
      <td className="py-2.5 px-2 text-[11px] text-faint font-mono">{p.ordre}</td>
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-2">
          {p.verrouille && <span className="text-[11px] text-faint" title="Verrouille">&#128274;</span>}
          <span className="font-medium text-[13px]">{p.libelle}</span>
        </div>
      </td>
      <td className="py-2.5 px-2">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', typeCfg.classes)}>
          {typeCfg.label}
        </span>
      </td>
      <td className="py-2.5 px-2 text-dim text-[12px]">{ASSIGNE_LABEL[p.assigne_a] ?? p.assigne_a}</td>
      <td className="py-2.5 px-2 text-center">
        {p.bloquant_si_ko && <span className="bg-red/15 text-red text-[10px] font-bold px-1.5 py-0.5 rounded-md">KO</span>}
      </td>
      <td className="py-2.5 px-2 text-center">
        {p.photo_obligatoire && <span className="text-dim text-[12px]" title="Photo obligatoire">&#128247;</span>}
      </td>
      <td className="py-2.5 px-2 text-dim text-[11px] truncate max-w-[120px]">{p.norme_associee ?? '--'}</td>
      <td className="py-2.5 px-2 text-center">
        {p.actif
          ? <span className="bg-green/15 text-green text-[10px] font-bold px-1.5 py-0.5 rounded-md">Oui</span>
          : <span className="bg-faint/20 text-faint text-[10px] font-bold px-1.5 py-0.5 rounded-md">Non</span>
        }
      </td>
    </tr>
  );
}

function MobileCard({ point: p, onSelect }: { point: PointBibliothequeAvecJoins; onSelect: () => void }) {
  const typeCfg = TYPE_CONFIG[p.type_controle];
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left bg-bg-card rounded-xl p-3 px-4 border border-white/[0.06] active:bg-white/[0.03] transition-colors mb-1.5',
        !p.actif && 'opacity-40'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          {p.verrouille && <span className="text-[11px] text-faint">&#128274;</span>}
          <span className="text-[11px] text-faint font-mono">#{p.ordre}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {p.bloquant_si_ko && <span className="bg-red/15 text-red text-[10px] font-bold px-1.5 py-0.5 rounded-md">KO</span>}
          {p.photo_obligatoire && <span className="text-dim text-[12px]">&#128247;</span>}
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', typeCfg.classes)}>
            {typeCfg.label}
          </span>
        </div>
      </div>
      <div className="text-[13px] font-medium mb-1">{p.libelle}</div>
      <div className="flex items-center gap-2 text-[11px] text-dim">
        <span>{ASSIGNE_LABEL[p.assigne_a] ?? p.assigne_a}</span>
        {p.norme_associee && (
          <>
            <span className="text-faint">|</span>
            <span className="text-faint truncate">{p.norme_associee}</span>
          </>
        )}
      </div>
    </button>
  );
}

function EmptyState({ onCreer }: { onCreer: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="text-dim text-sm mb-1">Aucun point de controle trouve.</div>
      <div className="text-faint text-xs mb-5">Ajustez vos filtres ou creez un nouveau point.</div>
      <button
        onClick={onCreer}
        className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
      >
        + Nouveau point
      </button>
    </div>
  );
}
