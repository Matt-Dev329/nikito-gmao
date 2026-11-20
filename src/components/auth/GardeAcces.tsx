import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { aAcces } from '@/lib/acces';

/** Page réservée à certains rôles (cf lib/acces) : sinon retour à l'accueil. */
export function GardeAcces({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { utilisateur } = useAuth();
  if (utilisateur && !aAcces(utilisateur, roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Fonctionnalité désactivée (Administration IT → fonctionnalités) : page fermée */
export function GardeFonction({ code, children }: { code: string; children: ReactNode }) {
  const { hasAccess } = useFeatureFlags();
  if (!hasAccess(code)) return <Navigate to="/gmao" replace />;
  return <>{children}</>;
}
