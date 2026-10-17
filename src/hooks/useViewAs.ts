import { create } from 'zustand';
import type { RoleUtilisateur } from '@/types/database';
import { rolesAttribuables } from '@/lib/acces';

interface ViewAsState {
  role: RoleUtilisateur | null;
  parcId: string | null;
  parcLabel: string | null;
  userLabel: string | null;
  /** Vue « manager principal » (badge MGR) : débloque ses onglets de pilotage */
  principal: boolean;
  activate: (
    role: RoleUtilisateur,
    parcId?: string | null,
    parcLabel?: string | null,
    userLabel?: string | null,
    principal?: boolean
  ) => void;
  reset: () => void;
}

export const useViewAs = create<ViewAsState>((set) => ({
  role: null,
  parcId: null,
  parcLabel: null,
  userLabel: null,
  principal: false,
  activate: (role, parcId = null, parcLabel = null, userLabel = null, principal = false) =>
    set({ role, parcId, parcLabel, userLabel, principal: role === 'manager_parc' && principal }),
  reset: () => set({ role: null, parcId: null, parcLabel: null, userLabel: null, principal: false }),
}));

export function useEffectiveRole(realRole: RoleUtilisateur): RoleUtilisateur {
  const viewAsRole = useViewAs((s) => s.role);
  // Seulement un rôle de son niveau ou en dessous (même règle que la gestion des comptes)
  return viewAsRole && rolesAttribuables(realRole).includes(viewAsRole) ? viewAsRole : realRole;
}
