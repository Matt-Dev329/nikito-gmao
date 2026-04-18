import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  rolesAutorises?: string[];
}

export function RouteProtegee({ children, rolesAutorises }: Props) {
  const { authUser, utilisateur, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-app">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  if (sessionStorage.getItem('alba_2fa_pending') === 'true') {
    return <Navigate to="/login" replace />;
  }

  if (rolesAutorises && utilisateur && !rolesAutorises.includes(utilisateur.role_code)) {
    return <Navigate to="/gmao" replace />;
  }

  return <>{children}</>;
}
