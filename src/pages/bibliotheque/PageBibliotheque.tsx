import { useState, useMemo } from 'react';
import { useBibliothequePoints } from '@/hooks/queries/useBibliotheque';
import { FiltresBibliotheque } from '@/components/bibliotheque/FiltresBibliotheque';
import { TableBibliotheque } from '@/components/bibliotheque/TableBibliotheque';
import { ModaleDetailPoint } from '@/components/bibliotheque/ModaleDetailPoint';
import { ModaleCreerPoint } from '@/components/bibliotheque/ModaleCreerPoint';
import { SignalerInlineButton } from '@/components/shared/SignalerInlineButton';
import type { PointBibliothequeAvecJoins, TypeControle, AssigneA } from '@/types/database';

export function PageBibliotheque() {
  const [categorieFilter, setCategorieFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<TypeControle | 'tous'>('tous');
  const [assigneFilter, setAssigneFilter] = useState<AssigneA | 'tous'>('tous');
  const [recherche, setRecherche] = useState('');
  const [afficherInactifs, setAfficherInactifs] = useState(false);

  const [modaleCreer, setModaleCreer] = useState(false);
  const [pointSelectionne, setPointSelectionne] = useState<PointBibliothequeAvecJoins | null>(null);

  const { data: points, isLoading } = useBibliothequePoints();

  const filtres = useMemo(() => {
    let result = points ?? [];

    if (!afficherInactifs) {
      result = result.filter((p) => p.actif);
    }

    if (categorieFilter) {
      result = result.filter((p) => p.categorie_id === categorieFilter);
    }

    if (typeFilter !== 'tous') {
      result = result.filter((p) => p.type_controle === typeFilter);
    }

    if (assigneFilter !== 'tous') {
      result = result.filter((p) => p.assigne_a === assigneFilter);
    }

    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter((p) => p.libelle.toLowerCase().includes(q));
    }

    return result;
  }, [points, categorieFilter, typeFilter, assigneFilter, recherche, afficherInactifs]);

  const compteurs = useMemo(() => {
    const actifs = (points ?? []).filter((p) => p.actif);
    return {
      total: actifs.length,
      quotidien: actifs.filter((p) => p.type_controle === 'quotidien').length,
      hebdo: actifs.filter((p) => p.type_controle === 'hebdo').length,
      mensuel: actifs.filter((p) => p.type_controle === 'mensuel').length,
    };
  }, [points]);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Bibliotheque points de controle</h1>
          <div className="text-[13px] text-dim mt-1">
            Referentiel des points de controle (quotidien / hebdo / mensuel)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModaleCreer(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center"
          >
            <span className="text-base">+</span> Nouveau point
          </button>
          <div className="hidden md:flex items-center gap-2 ml-1">
            <div className="h-8 w-px bg-white/[0.08]" />
            <SignalerInlineButton />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Compteur label="Total actifs" value={compteurs.total} />
        <Compteur label="Quotidien" value={compteurs.quotidien} color="green" />
        <Compteur label="Hebdo" value={compteurs.hebdo} color="amber" />
        <Compteur label="Mensuel" value={compteurs.mensuel} color="pink" />
      </div>

      <FiltresBibliotheque
        categorieId={categorieFilter}
        onCategorieChange={setCategorieFilter}
        typeControle={typeFilter}
        onTypeChange={setTypeFilter}
        assigneA={assigneFilter}
        onAssigneChange={setAssigneFilter}
        recherche={recherche}
        onRechercheChange={setRecherche}
        afficherInactifs={afficherInactifs}
        onAfficherInactifsChange={setAfficherInactifs}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-12 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {filtres.length !== (points ?? []).length && (
            <div className="text-[12px] text-dim mb-3">
              {filtres.length} point{filtres.length !== 1 ? 's' : ''} affiche{filtres.length !== 1 ? 's' : ''}
            </div>
          )}
          <TableBibliotheque
            points={filtres}
            onSelect={setPointSelectionne}
            onCreer={() => setModaleCreer(true)}
          />
        </>
      )}

      {modaleCreer && (
        <ModaleCreerPoint onClose={() => setModaleCreer(false)} />
      )}

      {pointSelectionne && (
        <ModaleDetailPoint
          point={pointSelectionne}
          onClose={() => setPointSelectionne(null)}
        />
      )}
    </div>
  );
}

function Compteur({ label, value, color }: { label: string; value: number; color?: 'green' | 'amber' | 'pink' }) {
  const textColor = color === 'green' ? 'text-green' : color === 'amber' ? 'text-amber' : color === 'pink' ? 'text-nikito-pink' : 'text-text';
  return (
    <div className="bg-bg-card rounded-xl px-4 py-2.5 border border-white/[0.06] min-w-[100px]">
      <div className="text-[10px] text-dim uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-semibold ${textColor}`}>{value}</div>
    </div>
  );
}
