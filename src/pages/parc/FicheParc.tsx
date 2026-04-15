import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useParc } from '@/hooks/queries/useReferentiel';
import { useAttractionsParc } from '@/hooks/queries/useAttractionsParc';
import { usePointsPourParc } from '@/hooks/queries/usePointsCategoriePourParc';
import { NotesChantierParc } from './NotesChantierParc';

type Onglet = 'apercu' | 'configuration' | 'controles' | 'equipements' | 'equipe' | 'notes';

export function FicheParc() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: parc } = useParc(id);
  const [onglet, setOnglet] = useState<Onglet>('apercu');

  return (
    <div>
      <header className="bg-bg-card border-b border-white/[0.06] px-7 pt-5 pb-0">
        <div className="flex items-center gap-2 text-[11px] text-dim mb-1">
          <button onClick={() => navigate('/admin/parcs')} className="hover:text-nikito-cyan">
            Parcs
          </button>
          <span>›</span>
          <span className="text-nikito-cyan">{parc?.code ?? '...'}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[22px] font-semibold m-0">
              {parc?.nom ?? 'Chargement...'}
            </h1>
            <div className="text-[13px] text-dim mt-1">
              {parc?.adresse} {'\u00b7'} {parc?.ville} ({parc?.code_postal})
            </div>
          </div>
          {parc?.ouvert_7j7 && (
            <span className="bg-amber/15 text-amber px-2.5 py-0.5 rounded-md text-[10px] font-bold">
              7J/7
            </span>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          <OngletButton actif={onglet === 'apercu'} onClick={() => setOnglet('apercu')}>
            Vue d'ensemble
          </OngletButton>
          <OngletButton
            actif={onglet === 'configuration'}
            onClick={() => setOnglet('configuration')}
          >
            Configuration
          </OngletButton>
          <OngletButton actif={onglet === 'controles'} onClick={() => setOnglet('controles')}>
            Contr{'\u00f4'}les
          </OngletButton>
          <OngletButton actif={onglet === 'equipements'} onClick={() => setOnglet('equipements')}>
            {'\u00c9'}quipements
          </OngletButton>
          <OngletButton actif={onglet === 'equipe'} onClick={() => setOnglet('equipe')}>
            {'\u00c9'}quipe
          </OngletButton>
          <OngletButton actif={onglet === 'notes'} onClick={() => setOnglet('notes')}>
            Notes chantier
          </OngletButton>
        </div>
      </header>

      {onglet === 'apercu' && <OngletApercu />}
      {onglet === 'configuration' && <OngletConfiguration />}
      {onglet === 'controles' && <OngletControles parcId={id} />}
      {onglet === 'equipements' && <OngletEquipements />}
      {onglet === 'equipe' && <OngletEquipe />}
      {onglet === 'notes' && <NotesChantierParc />}
    </div>
  );
}

function OngletButton({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 text-[13px]',
        actif ? 'text-text font-semibold border-b-2 border-nikito-pink' : 'text-dim'
      )}
    >
      {children}
    </button>
  );
}

function OngletApercu() {
  return <div className="p-6 px-7 text-dim text-sm">Vue d'ensemble {'\u00b7'} KPI parc, alertes du jour</div>;
}

function OngletConfiguration() {
  return <div className="p-6 px-7 text-dim text-sm">{'\u00c9'}dition identit{'\u00e9'}, plan, zones, attractions</div>;
}

function OngletControles({ parcId }: { parcId: string | undefined }) {
  const { data: attractions, isLoading: loadingAttr } = useAttractionsParc(parcId);
  const { data: points, isLoading: loadingPts } = usePointsPourParc(parcId);

  const statsParType = useMemo(() => {
    if (!points) return { quotidien: 0, hebdo: 0, mensuel: 0 };
    const actifs = points.filter((p) => p.actif_pour_parc);
    return {
      quotidien: actifs.filter((p) => p.type_controle === 'quotidien').length,
      hebdo: actifs.filter((p) => p.type_controle === 'hebdo').length,
      mensuel: actifs.filter((p) => p.type_controle === 'mensuel').length,
    };
  }, [points]);

  const isLoading = loadingAttr || loadingPts;

  if (isLoading) {
    return (
      <div className="p-7 flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-7">
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
          <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Quotidien</div>
          <div className="text-2xl font-bold text-nikito-cyan">{statsParType.quotidien}</div>
          <div className="text-[11px] text-dim">points actifs</div>
        </div>
        <div className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
          <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Hebdo</div>
          <div className="text-2xl font-bold text-nikito-pink">{statsParType.hebdo}</div>
          <div className="text-[11px] text-dim">points actifs</div>
        </div>
        <div className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
          <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Mensuel</div>
          <div className="text-2xl font-bold text-nikito-violet">{statsParType.mensuel}</div>
          <div className="text-[11px] text-dim">points actifs</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold">
          Attractions configur{'\u00e9'}es ({attractions?.length ?? 0})
        </h3>
        <Link
          to={`/admin/parcs/${parcId}/attractions`}
          className="text-nikito-cyan text-[12px] hover:underline"
        >
          G{'\u00e9'}rer les attractions
        </Link>
      </div>

      {!attractions || attractions.length === 0 ? (
        <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
          <p className="text-dim text-sm mb-3">Aucune attraction configur{'\u00e9'}e</p>
          <Link
            to={`/admin/parcs/${parcId}/attractions`}
            className="inline-block bg-gradient-cta text-text px-5 py-2.5 rounded-xl text-[13px] font-semibold"
          >
            Configurer
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {attractions.map((a) => {
            const cat = a.categories_equipement;
            const pts = points?.filter((p) => p.categorie_id === a.categorie_id) ?? [];
            const actifs = pts.filter((p) => p.actif_pour_parc).length;

            return (
              <Link
                key={a.id}
                to={`/admin/parcs/${parcId}/points/${a.categorie_id}`}
                className="bg-bg-card rounded-xl p-3.5 px-5 border border-white/[0.06] flex items-center gap-4 hover:border-nikito-cyan/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium">{cat.nom}</span>
                  <span className="text-[11px] text-dim ml-2">x{a.quantite}</span>
                </div>
                <span className="text-[12px] text-dim">{actifs}/{pts.length} points</span>
                <span className="text-dim text-sm">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OngletEquipements() {
  return <div className="p-6 px-7 text-dim text-sm">Liste d{'\u00e9'}taill{'\u00e9'}e des {'\u00e9'}quipements de ce parc</div>;
}

function OngletEquipe() {
  return <div className="p-6 px-7 text-dim text-sm">Utilisateurs assign{'\u00e9'}s {'\u00e0'} ce parc</div>;
}
