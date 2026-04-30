import { create } from 'zustand';
import type { RoleUtilisateur } from '@/types/database';

interface ViewAsState {
  role: RoleUtilisateur | null;
  parcId: string | null;
  parcLabel: string | null;
  userLabel: string | null;
  activate: (role: RoleUtilisateur, parcId?: string | null, parcLabel?: string | null, userLabel?: string | null) => void;
  reset: () => void;
}

export const useViewAs = create<ViewAsState>((set) => ({
  role: null,
  parcId: null,
  parcLabel: null,
  userLabel: null,
  activate: (role, parcId = null, parcLabel = null, userLabel = null) =>
    set({ role, parcId, parcLabel, userLabel }),
  reset: () => set({ role: null, parcId: null, parcLabel: null, userLabel: null }),
}));

export function useEffectiveRole(realRole: RoleUtilisateur): RoleUtilisateur {
  const viewAsRole = useViewAs((s) => s.role);
  const canViewAs = realRole === 'direction' || realRole === 'chef_maintenance' || realRole === 'admin_it';
  return canViewAs && viewAsRole ? viewAsRole : realRole;
}
