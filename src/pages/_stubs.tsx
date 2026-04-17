// ============================================================
// Page stubs · a completer
// ============================================================

import { useNavigate } from 'react-router-dom';
import { useFournisseurs } from '@/hooks/queries/useReferentiel';

export { PageEquipements } from '@/pages/equipements/PageEquipements';
export { PageStock } from '@/pages/stock/PageStock';
export { PageBibliotheque } from '@/pages/bibliotheque/PageBibliotheque';
export { FicheCinqPourquoi } from '@/pages/cinq-pourquoi/FicheCinqPourquoi';
export { ListeCinqPourquoi } from '@/pages/cinq-pourquoi/ListeCinqPourquoi';
export { PagePlaintes } from '@/pages/plaintes/PagePlaintes';
export { PagePreventif } from '@/pages/preventif/PagePreventif';
export { PageCertifications } from '@/pages/certifications/PageCertifications';

export function ControleMensuel() {
  return (
    <div className="p-4 md:p-6 md:px-7">
      Controle mensuel - a venir (validation binome requise)
    </div>
  );
}

export function PageUtilisateurs() {
  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex justify-between items-start mb-[22px]">
        <div>
          <h1 className="text-[22px] font-semibold m-0">Utilisateurs</h1>
          <div className="text-[13px] text-dim mt-1">
            Gestion des comptes, roles, attribution parcs, PIN staff
          </div>
        </div>
        <button className="bg-gradient-cta text-text px-4 py-2.5 rounded-lg text-[13px] font-bold min-h-[44px]">
          + Inviter un utilisateur
        </button>
      </div>
    </div>
  );
}

export function PageFournisseurs() {
  const { data: fournisseurs } = useFournisseurs();
  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex justify-between items-start mb-[22px]">
        <div>
          <h1 className="text-[22px] font-semibold m-0">Fournisseurs</h1>
          <div className="text-[13px] text-dim mt-1">{fournisseurs?.length ?? 0} fournisseurs</div>
        </div>
      </div>
    </div>
  );
}

export function VueManagerParc() {
  return (
    <div className="p-4 md:p-6 md:px-7">
      <h1 className="text-[22px] font-semibold m-0">Mon parc - vue manager</h1>
    </div>
  );
}

export function PageProfil() {
  return (
    <div className="p-4 md:p-6 md:px-7">
      <h1 className="text-[22px] font-semibold m-0">Mon profil</h1>
    </div>
  );
}

export function PageTechStock() {
  return (
    <div className="p-4 md:p-6 md:px-7">
      <h1 className="text-[22px] font-semibold m-0">Stock</h1>
      <div className="text-[13px] text-dim mt-1">Vue stock terrain - bientot disponible</div>
    </div>
  );
}

export function PageTechSignaler() {
  return (
    <div className="p-4 md:p-6 md:px-7">
      <h1 className="text-[22px] font-semibold m-0">Signaler</h1>
      <div className="text-[13px] text-dim mt-1">Signalement d'incident - bientot disponible</div>
    </div>
  );
}

export function MesSignalements() {
  const navigate = useNavigate();
  return (
    <div className="p-4 md:p-6 md:px-7">
      <button onClick={() => navigate(-1)} className="text-nikito-cyan text-sm mb-3">
        &lsaquo; Retour
      </button>
      <h1 className="text-[22px] font-semibold m-0">Mes signalements du jour</h1>
    </div>
  );
}
