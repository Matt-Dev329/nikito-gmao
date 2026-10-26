import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { aAcces, ROLES_HISTORIQUE_COMMANDES } from '@/lib/acces';
import { OngletHistorique } from '@/pages/commandes/OngletHistorique';

/**
 * Historique de toutes les commandes (passées et en cours) : le chef d'équipe
 * voit tout, les directeurs de parc et managers principaux celles de leurs
 * parcs (droits en base : voit_tout_le_parc).
 */
export function PageHistoriqueCommandes() {
  const { utilisateur } = useAuth();
  if (utilisateur && !aAcces(utilisateur, ROLES_HISTORIQUE_COMMANDES)) return <Navigate to="/gmao/operations" replace />;
  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="mb-4">
        <h1 className="text-xl md:text-[22px] font-semibold m-0">Historique des commandes</h1>
        <p className="text-[13px] text-dim mt-1">Toutes les commandes de tes parcs, en cours et passées, quel que soit le demandeur</p>
      </div>
      <OngletHistorique />
    </div>
  );
}
