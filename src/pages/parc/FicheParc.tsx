import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useParc } from '@/hooks/queries/useReferentiel';
import { NotesChantierParc } from './NotesChantierParc';

// ============================================================
// Fiche parc (admin) · onglets :
//   - Vue d'ensemble : KPI, équipe, contrôles du jour
//   - Configuration : édition identité, plan, zones, attractions
//   - Équipements : liste détaillée
//   - Équipe : utilisateurs assignés
//   - Notes chantier : historique permanent ⭐
// ============================================================

type Onglet = 'apercu' | 'configuration' | 'equipements' | 'equipe' | 'notes';

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
              {parc?.adresse} · {parc?.ville} ({parc?.code_postal})
            </div>
          </div>
          {parc?.ouvert_7j7 && (
            <span className="bg-amber/15 text-amber px-2.5 py-0.5 rounded-md text-[10px] font-bold">
              7J/7
            </span>
          )}
        </div>

        <div className="flex gap-1.5">
          <OngletButton actif={onglet === 'apercu'} onClick={() => setOnglet('apercu')}>
            Vue d'ensemble
          </OngletButton>
          <OngletButton
            actif={onglet === 'configuration'}
            onClick={() => setOnglet('configuration')}
          >
            Configuration
          </OngletButton>
          <OngletButton actif={onglet === 'equipements'} onClick={() => setOnglet('equipements')}>
            Équipements
          </OngletButton>
          <OngletButton actif={onglet === 'equipe'} onClick={() => setOnglet('equipe')}>
            Équipe
          </OngletButton>
          <OngletButton actif={onglet === 'notes'} onClick={() => setOnglet('notes')}>
            📝 Notes chantier
          </OngletButton>
        </div>
      </header>

      {onglet === 'apercu' && <OngletApercu />}
      {onglet === 'configuration' && <OngletConfiguration />}
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
  return <div className="p-6 px-7 text-dim text-sm">Vue d'ensemble · KPI parc, alertes du jour</div>;
}

function OngletConfiguration() {
  return <div className="p-6 px-7 text-dim text-sm">Édition identité, plan, zones, attractions</div>;
}

function OngletEquipements() {
  return <div className="p-6 px-7 text-dim text-sm">Liste détaillée des équipements de ce parc</div>;
}

function OngletEquipe() {
  return <div className="p-6 px-7 text-dim text-sm">Utilisateurs assignés à ce parc</div>;
}
