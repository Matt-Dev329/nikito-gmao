import { EcranChargement } from '@/components/ui/EcranChargement';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTechnicienKartingEffectif, useVueSimulee } from '@/hooks/useViewAs';
import { cheminOuvertTechnicienKarting } from '@/lib/acces';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { resolveParcCourant } from '@/hooks/useParcCourant';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  rolesAutorises?: string[];
  skipParcCheck?: boolean;
}

export function RouteProtegee({ children, rolesAutorises, skipParcCheck }: Props) {
  const { authUser, utilisateur, loading, mustChangePassword } = useAuth();
  const location = useLocation();
  const { data: allParcs, isLoading: parcsLoading } = useParcs();
  const vueSimulee = useVueSimulee(utilisateur);
  const karting = useTechnicienKartingEffectif(utilisateur);

  if (loading || parcsLoading) {
    return <EcranChargement />;
  }

  if (!authUser) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  if (mustChangePassword && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  // Arcade consultation : uniquement sa page de consultation des tickets arcade
  if (utilisateur?.role_code === 'consultation_arcade' || vueSimulee?.role === 'consultation_arcade') {
    return <Navigate to="/arcade" replace />;
  }

  // Technicien Karting : uniquement les pages qui concernent le karting
  if (karting && !cheminOuvertTechnicienKarting(location.pathname)) {
    return <Navigate to="/gmao/operations" replace />;
  }

  if (rolesAutorises && utilisateur && !rolesAutorises.includes(utilisateur.role_code)) {
    return <Navigate to="/gmao" replace />;
  }

  if (!skipParcCheck && utilisateur && allParcs) {
    const parcIds = utilisateur.parc_ids;
    const isOnSelectParc = location.pathname === '/gmao/select-parc';

    if (parcIds.length === 0 && !isOnSelectParc) {
      return <Navigate to="/gmao/select-parc" replace />;
    }

    const resolved = resolveParcCourant(parcIds, allParcs);

    if (!resolved && parcIds.length > 1 && !isOnSelectParc) {
      return <Navigate to="/gmao/select-parc" replace />;
    }
  }

  return <>{children}</>;
}

/** Pages staff (contrôle d'ouverture, hebdo staff) : fermées au technicien Karting */
export function FermeAuTechnicienKarting({ children }: { children: ReactNode }) {
  const { utilisateur } = useAuth();
  const karting = useTechnicienKartingEffectif(utilisateur);
  if (karting) return <Navigate to="/gmao/operations" replace />;
  return <>{children}</>;
}
