import { useNavigate } from 'react-router-dom';

export { PageEquipements } from '@/pages/equipements/PageEquipements';
export { PageStock } from '@/pages/stock/PageStock';
export { PageBibliotheque } from '@/pages/bibliotheque/PageBibliotheque';
export { FicheCinqPourquoi } from '@/pages/cinq-pourquoi/FicheCinqPourquoi';
export { ListeCinqPourquoi } from '@/pages/cinq-pourquoi/ListeCinqPourquoi';
export { PagePlaintes } from '@/pages/plaintes/PagePlaintes';
export { PagePreventif } from '@/pages/preventif/PagePreventif';
export { PageCertifications } from '@/pages/certifications/PageCertifications';
export { PageProfil } from '@/pages/profil/PageProfil';
export { VueManagerParc } from '@/pages/parc/VueManagerParc';

export { ControleMensuel } from '@/pages/technicien/ControleMensuel';

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
