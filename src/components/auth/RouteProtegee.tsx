import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { resolveParcCourant } from '@/hooks/useParcCourant';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  rolesAutorises?: string[];
  skipParcCheck?: boolean;
}

export function RouteProtegee({ children, rolesAutorises, skipParcCheck }: Props) {
  const { authUser, utilisateur, loading } = useAuth();
  const location = useLocation();
  const { data: allParcs, isLoading: parcsLoading } = useParcs();

  if (loading || parcsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-app">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
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
