import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { aAcces } from '@/lib/acces';

/** Page réservée à certains rôles (cf lib/acces) : sinon retour à l'accueil. */
export function GardeAcces({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { utilisateur } = useAuth();
  if (utilisateur && !aAcces(utilisateur, roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
