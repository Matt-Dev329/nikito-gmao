import { useState, useMemo } from 'react';
import { useEquipements } from '@/hooks/queries/useReferentiel';
import { FiltresEquipements } from '@/components/equipements/FiltresEquipements';
import { TableEquipements } from '@/components/equipements/TableEquipements';
import { ModaleCreerEquipement } from '@/components/equipements/ModaleCreerEquipement';
import { ModaleDetailEquipement } from '@/components/equipements/ModaleDetailEquipement';
import { ModaleImportCSV } from '@/components/equipements/ModaleImportCSV';
import { SignalerInlineButton } from '@/components/shared/SignalerInlineButton';
import type { EquipementAvecJoins, StatutEquipement } from '@/types/database';

export function PageEquipements() {
  const [parcFilter, setParcFilter] = useState<string | undefined>(undefined);
  const [categorieFilter, setCategorieFilter] = useState<string | undefined>(undefined);
  const [statutFilter, setStatutFilter] = useState<StatutEquipement | 'tous'>('tous');
  const [recherche, setRecherche] = useState('');

  const [modaleCreer, setModaleCreer] = useState(false);
  const [modaleImport, setModaleImport] = useState(false);
  const [equipementSelectionne, setEquipementSelectionne] = useState<EquipementAvecJoins | null>(null);

  const { data: equipements, isLoading } = useEquipements(parcFilter);

  const filtres = useMemo(() => {
    let result = equipements ?? [];

    if (categorieFilter) {
      result = result.filter((e) => e.categorie_id === categorieFilter);
    }

    if (statutFilter !== 'tous') {
      result = result.filter((e) => e.statut === statutFilter);
    }

    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter(
        (e) =>
          e.code.toLowerCase().includes(q) ||
          e.libelle.toLowerCase().includes(q) ||
          (e.numero_serie && e.numero_serie.toLowerCase().includes(q))
      );
    }

    return result;
  }, [equipements, categorieFilter, statutFilter, recherche]);

  const nbTotal = equipements?.length ?? 0;

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Equipements</h1>
          <div className="text-[13px] text-dim mt-1">
            {nbTotal} equipement{nbTotal !== 1 ? 's' : ''}
            {filtres.length !== nbTotal && ` · ${filtres.length} affiche${filtres.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setModaleImport(true)}
            className="bg-bg-card border border-nikito-cyan/40 text-nikito-cyan px-3 py-2.5 rounded-[10px] text-xs font-semibold min-h-[44px] flex-1 sm:flex-none"
          >
            Importer CSV
          </button>
          <button
            onClick={() => setModaleCreer(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] flex-1 sm:flex-none justify-center"
          >
            <span className="text-base">+</span> Nouvel equipement
          </button>
          <div className="hidden md:flex items-center gap-2 ml-1">
            <div className="h-8 w-px bg-white/[0.08]" />
            <SignalerInlineButton />
          </div>
        </div>
      </div>

      <FiltresEquipements
        parcId={parcFilter}
        onParcChange={setParcFilter}
        categorieId={categorieFilter}
        onCategorieChange={setCategorieFilter}
        statut={statutFilter}
        onStatutChange={setStatutFilter}
        recherche={recherche}
        onRechercheChange={setRecherche}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-14 animate-pulse" />
          ))}
        </div>
      ) : (
        <TableEquipements
          equipements={filtres}
          onSelect={setEquipementSelectionne}
          onCreer={() => setModaleCreer(true)}
          onImporter={() => setModaleImport(true)}
        />
      )}

      {modaleCreer && (
        <ModaleCreerEquipement onClose={() => setModaleCreer(false)} />
      )}

      {modaleImport && (
        <ModaleImportCSV onClose={() => setModaleImport(false)} />
      )}

      {equipementSelectionne && (
        <ModaleDetailEquipement
          equipement={equipementSelectionne}
          onClose={() => setEquipementSelectionne(null)}
        />
      )}
    </div>
  );
}
