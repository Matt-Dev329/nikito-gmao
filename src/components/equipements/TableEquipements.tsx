import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { EquipementAvecJoins, StatutEquipement } from '@/types/database';

type SortKey = 'code' | 'libelle' | 'categorie' | 'parc' | 'zone' | 'statut' | 'date_mise_service' | 'date_fin_garantie';
type SortDir = 'asc' | 'desc';

const STATUT_CONFIG: Record<StatutEquipement, { label: string; classes: string }> = {
  actif: { label: 'Actif', classes: 'bg-green/15 text-green' },
  maintenance: { label: 'Maintenance', classes: 'bg-amber/15 text-amber' },
  hors_service: { label: 'Hors service', classes: 'bg-red/15 text-red' },
  archive: { label: 'Archive', classes: 'bg-faint/20 text-dim' },
};

const PAGE_SIZE = 50;

interface TableEquipementsProps {
  equipements: EquipementAvecJoins[];
  onSelect: (eq: EquipementAvecJoins) => void;
  onCreer: () => void;
  onImporter: () => void;
}

function getSortValue(eq: EquipementAvecJoins, key: SortKey): string {
  switch (key) {
    case 'code': return eq.code;
    case 'libelle': return eq.libelle;
    case 'categorie': return eq.categories_equipement?.nom ?? '';
    case 'parc': return eq.parcs?.code ?? '';
    case 'zone': return eq.zones?.nom ?? '';
    case 'statut': return eq.statut;
    case 'date_mise_service': return eq.date_mise_service ?? '';
    case 'date_fin_garantie': return eq.date_fin_garantie ?? '';
  }
}

function formatDate(d: string | null): string {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isGarantieExpiree(d: string | null): boolean {
  if (!d) return false;
  return new Date(d) < new Date();
}

export function TableEquipements({ equipements, onSelect, onCreer, onImporter }: TableEquipementsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...equipements];
    arr.sort((a, b) => {
      const va = getSortValue(a, sortKey).toLowerCase();
      const vb = getSortValue(b, sortKey).toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [equipements, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  if (equipements.length === 0) {
    return <EmptyState onCreer={onCreer} onImporter={onImporter} />;
  }

  return (
    <div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-[11px] text-dim uppercase tracking-wider font-medium py-3 px-3 cursor-pointer hover:text-text transition-colors whitespace-nowrap select-none"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-nikito-cyan">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                  )}
                </th>
              ))}
              <th className="text-[11px] text-dim uppercase tracking-wider font-medium py-3 px-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {paginated.map((eq) => (
              <tr
                key={eq.id}
                onClick={() => onSelect(eq)}
                className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <td className="py-3 px-3 font-mono text-[12px] text-nikito-cyan">{eq.code}</td>
                <td className="py-3 px-3 font-medium">{eq.libelle}</td>
                <td className="py-3 px-3 text-dim">{eq.categories_equipement?.nom ?? '--'}</td>
                <td className="py-3 px-3">
                  <span className="text-[10px] font-semibold bg-bg-deep border border-white/[0.06] text-dim px-1.5 py-0.5 rounded">
                    {eq.parcs?.code ?? '--'}
                  </span>
                </td>
                <td className="py-3 px-3 text-dim">{eq.zones?.nom ?? '--'}</td>
                <td className="py-3 px-3">
                  <StatutBadge statut={eq.statut} />
                </td>
                <td className="py-3 px-3 text-dim text-[12px]">{formatDate(eq.date_mise_service)}</td>
                <td className={cn('py-3 px-3 text-[12px]', isGarantieExpiree(eq.date_fin_garantie) ? 'text-red font-semibold' : 'text-dim')}>
                  {formatDate(eq.date_fin_garantie)}
                </td>
                <td className="py-3 px-3 text-center">
                  {eq.a_surveiller && (
                    <span className="bg-amber/15 text-amber text-[10px] font-bold px-1.5 py-0.5 rounded-md">!</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex flex-col gap-2">
        {paginated.map((eq) => (
          <EquipementCard key={eq.id} eq={eq} onSelect={() => onSelect(eq)} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'code', label: 'Code' },
  { key: 'libelle', label: 'Libelle' },
  { key: 'categorie', label: 'Categorie' },
  { key: 'parc', label: 'Parc' },
  { key: 'zone', label: 'Zone' },
  { key: 'statut', label: 'Statut' },
  { key: 'date_mise_service', label: 'Mise en service' },
  { key: 'date_fin_garantie', label: 'Garantie' },
];

function StatutBadge({ statut }: { statut: StatutEquipement }) {
  const cfg = STATUT_CONFIG[statut] ?? STATUT_CONFIG.actif;
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', cfg.classes)}>
      {cfg.label}
    </span>
  );
}

function EquipementCard({ eq, onSelect }: { eq: EquipementAvecJoins; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left bg-bg-card rounded-xl p-3 px-4 border border-white/[0.06] active:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-[12px] text-nikito-cyan">{eq.code}</span>
        <div className="flex items-center gap-1.5">
          {eq.a_surveiller && (
            <span className="bg-amber/15 text-amber text-[10px] font-bold px-1.5 py-0.5 rounded-md">!</span>
          )}
          <StatutBadge statut={eq.statut} />
        </div>
      </div>
      <div className="text-[13px] font-medium mb-1">{eq.libelle}</div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-dim">
        <span>{eq.categories_equipement?.nom ?? '--'}</span>
        <span className="text-faint">|</span>
        <span className="font-semibold bg-bg-deep border border-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">
          {eq.parcs?.code ?? '--'}
        </span>
        {eq.zones?.nom && (
          <>
            <span className="text-faint">|</span>
            <span>{eq.zones.nom}</span>
          </>
        )}
      </div>
      {eq.date_fin_garantie && isGarantieExpiree(eq.date_fin_garantie) && (
        <div className="text-[10px] text-red font-semibold mt-1.5">
          Garantie expiree le {formatDate(eq.date_fin_garantie)}
        </div>
      )}
    </button>
  );
}

function EmptyState({ onCreer, onImporter }: { onCreer: () => void; onImporter: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="text-dim text-sm mb-1">Aucun equipement enregistre.</div>
      <div className="text-faint text-xs mb-5">
        Commencez par importer vos equipements via CSV ou creez-les manuellement.
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
        <button
          onClick={onImporter}
          className="bg-bg-card border border-nikito-cyan/40 text-nikito-cyan px-4 py-2.5 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
        >
          Importer CSV
        </button>
        <button
          onClick={onCreer}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
        >
          + Nouvel equipement
        </button>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/[0.06]">
      <button
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="bg-bg-deep border border-white/[0.08] text-dim px-3 py-1.5 rounded-lg text-xs disabled:opacity-30 min-h-[36px]"
      >
        Precedent
      </button>
      <span className="text-[12px] text-dim">
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="bg-bg-deep border border-white/[0.08] text-dim px-3 py-1.5 rounded-lg text-xs disabled:opacity-30 min-h-[36px]"
      >
        Suivant
      </button>
    </div>
  );
}
