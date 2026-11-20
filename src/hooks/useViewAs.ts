import { create } from 'zustand';
import type { RoleUtilisateur } from '@/types/database';
import { estTechnicienArcade, rolesAttribuables } from '@/lib/acces';

interface ViewAsState {
  role: RoleUtilisateur | null;
  parcId: string | null;
  parcLabel: string | null;
  userLabel: string | null;
  /** Vue « manager principal » (badge MGR) : débloque ses onglets de pilotage */
  principal: boolean;
  /** Vue technicien : type simulé (arcade, nikito ou polyvalent) */
  profil: string | null;
  activate: (
    role: RoleUtilisateur,
    parcId?: string | null,
    parcLabel?: string | null,
    userLabel?: string | null,
    principal?: boolean,
    profil?: string | null
  ) => void;
  reset: () => void;
}

export const useViewAs = create<ViewAsState>((set) => ({
  role: null,
  parcId: null,
  parcLabel: null,
  userLabel: null,
  principal: false,
  profil: null,
  activate: (role, parcId = null, parcLabel = null, userLabel = null, principal = false, profil = null) =>
    set({
      role,
      parcId,
      parcLabel,
      userLabel,
      principal: role === 'manager_parc' && principal,
      profil: role === 'technicien' ? profil ?? 'polyvalent' : null,
    }),
  reset: () => set({ role: null, parcId: null, parcLabel: null, userLabel: null, principal: false, profil: null }),
}));

export function useEffectiveRole(realRole: RoleUtilisateur): RoleUtilisateur {
  const viewAsRole = useViewAs((s) => s.role);
  // Seulement un rôle de son niveau ou en dessous (même règle que la gestion des comptes)
  return viewAsRole && rolesAttribuables(realRole).includes(viewAsRole) ? viewAsRole : realRole;
}

/** Vue « Voir comme » active et autorisée pour ce compte (son niveau ou en dessous) */
export function useVueSimulee(realRole: RoleUtilisateur | undefined) {
  const vue = useViewAs();
  const autorisee = !!vue.role && !!realRole && rolesAttribuables(realRole).includes(vue.role);
  return autorisee ? vue : null;
}

/** Technicien Arcade, réel ou simulé par « Voir comme » (affichage seulement) */
export function useTechnicienArcadeEffectif(
  u: { role_code: RoleUtilisateur; profil_technicien?: string | null } | null | undefined
): boolean {
  const vue = useVueSimulee(u?.role_code);
  if (vue) return vue.role === 'technicien' && vue.profil === 'arcade';
  return estTechnicienArcade(u);
}
