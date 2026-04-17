import { useState, useMemo } from 'react';
import { useHistoriqueControles, type ControleHistorique } from '@/hooks/queries/useHistoriqueControles';
import { FiltresHistorique } from './FiltresHistorique';
import { CompteursControles } from './CompteursControles';
import { TableControles } from './TableControles';
import { ModaleDetailControle } from './ModaleDetailControle';
import { exportControlesCSV } from './exportCSV';
import { exportControlePDF } from './exportPDF';
import type { TypeControle, StatutControle } from '@/types/database';

function get30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function PageHistoriqueControles() {
  const today = new Date().toISOString().slice(0, 10);
  const [dateDebut, setDateDebut] = useState(get30DaysAgo);
  const [dateFin, setDateFin] = useState(today);
  const [parcId, setParcId] = useState('');
  const [type, setType] = useState<TypeControle | ''>('');
  const [statut, setStatut] = useState<StatutControle | ''>('');
  const [recherche, setRecherche] = useState('');

  const [controleSelectionne, setControleSelectionne] = useState<ControleHistorique | null>(null);

  const filtres = useMemo(() => ({
    dateDebut,
    dateFin,
    parcId: parcId || undefined,
    type: type || undefined,
    statut: statut || undefined,
    recherche: recherche || undefined,
  }), [dateDebut, dateFin, parcId, type, statut, recherche]);

  const { data: controles, isLoading } = useHistoriqueControles(filtres);

  const handleVoir = (id: string) => {
    const c = controles?.find((ctrl) => ctrl.id === id);
    if (c) setControleSelectionne(c);
  };

  const handleNavigateCorrection = (id: string) => {
    const c = controles?.find((ctrl) => ctrl.id === id);
    if (c) setControleSelectionne(c);
  };

  return (
    <div className="p-4 md:p-6 md:px-7 space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold m-0">Historique des controles</h1>
        <div className="text-[13px] text-dim mt-1">Registre de conformite . DGCCRF</div>
      </div>

      <FiltresHistorique
        dateDebut={dateDebut}
        dateFin={dateFin}
        parcId={parcId}
        type={type}
        statut={statut}
        recherche={recherche}
        onChangeDateDebut={setDateDebut}
        onChangeDateFin={setDateFin}
        onChangeParcId={setParcId}
        onChangeType={setType}
        onChangeStatut={setStatut}
        onChangeRecherche={setRecherche}
      />

      {isLoading ? (
        <div className="text-dim text-sm py-6">Chargement des controles...</div>
      ) : (
        <>
          <CompteursControles controles={controles ?? []} />

          <div className="flex items-center justify-between">
            <div className="text-[11px] text-dim uppercase tracking-wider">
              {controles?.length ?? 0} controle{(controles?.length ?? 0) > 1 ? 's' : ''} trouves
            </div>
            <button
              onClick={() => exportControlesCSV(controles ?? [], dateDebut, dateFin)}
              disabled={!controles?.length}
              className="bg-bg-deep border border-white/[0.08] text-dim hover:text-text px-4 py-2 rounded-[10px] text-[12px] font-medium min-h-[40px] transition-colors disabled:opacity-40"
            >
              Exporter CSV
            </button>
          </div>

          <TableControles controles={controles ?? []} onVoir={handleVoir} />
        </>
      )}

      {controleSelectionne && (
        <ModaleDetailControle
          controle={controleSelectionne}
          onClose={() => setControleSelectionne(null)}
          onExportPDF={exportControlePDF}
          onNavigateCorrection={handleNavigateCorrection}
        />
      )}
    </div>
  );
}
