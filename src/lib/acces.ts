import type { RoleUtilisateur } from '@/types/database';

/**
 * Onglet Stock : visible par tous les rôles internes (hors staff), qui peuvent
 * tous faire des sorties. Les entrées et la création de pièces sont réservées
 * à ROLES_ENTREE_STOCK + gestionnaires des commandes (cf RPC mouvement_stock).
 */
export const ROLES_STOCK: RoleUtilisateur[] = ['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'];

/** Entrées de stock et création de pièces : chef d'équipe, direction, admin IT et gestionnaires des commandes */
export const ROLES_ENTREE_STOCK: RoleUtilisateur[] = ['direction', 'chef_maintenance', 'admin_it'];

export function peutEntrerStock(role: RoleUtilisateur | undefined, estGestionnaireCommandes: boolean): boolean {
  return estGestionnaireCommandes || (!!role && ROLES_ENTREE_STOCK.includes(role));
}

export function peutVoirStock(role: RoleUtilisateur | undefined, estGestionnaireCommandes: boolean): boolean {
  return estGestionnaireCommandes || (!!role && ROLES_STOCK.includes(role));
}

/**
 * Onglets de pilotage (rapports et analyses prestataires, formations du
 * personnel, certifications, préventif) : direction, chef d'équipe, admin IT,
 * directeurs de parc et managers principaux (badge MGR) — jamais les autres
 * managers. Même règle en base (acces_pilotage_parc).
 */
export const ROLES_PILOTAGE: string[] = ['direction', 'chef_maintenance', 'directeur_parc', 'admin_it', 'manager_principal'];

/** Récurrences et 5 Pourquoi : chef d'équipe, direction et admin IT */
export const ROLES_ANALYSE_CAUSES: string[] = ['direction', 'chef_maintenance', 'admin_it'];

interface UtilisateurAcces {
  role_code: string;
  parcs_manager_principal?: string[];
}

/** « manager_principal » : rôle virtuel des managers ayant le badge MGR sur au moins un parc */
export function estManagerPrincipal(u: UtilisateurAcces | null | undefined): boolean {
  return u?.role_code === 'manager_parc' && (u.parcs_manager_principal?.length ?? 0) > 0;
}

/** Un utilisateur a-t-il accès à un onglet réservé à `roles` (rôle virtuel manager_principal compris) ? */
export function aAcces(u: UtilisateurAcces | null | undefined, roles: string[]): boolean {
  if (!u) return false;
  return roles.includes(u.role_code) || (roles.includes('manager_principal') && estManagerPrincipal(u));
}

/**
 * Gestion des comptes « à hauteur de grade » (même règle qu'en base :
 * peut_gerer_compte) : direction, admin IT et chef d'équipe gèrent tous les
 * comptes ; un directeur de parc les directeurs, managers et staff de ses
 * parcs ; un manager les managers et le staff de ses parcs. Pas les autres.
 */
export const ROLES_GESTION_COMPTES: RoleUtilisateur[] = ['direction', 'admin_it', 'chef_maintenance', 'directeur_parc', 'manager_parc'];

/** Rôles qu'un utilisateur peut attribuer */
export function rolesAttribuables(role: RoleUtilisateur | undefined): RoleUtilisateur[] {
  switch (role) {
    case 'direction':
    case 'admin_it':
    case 'chef_maintenance':
      return ['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it', 'staff_operationnel'];
    case 'directeur_parc':
      return ['directeur_parc', 'manager_parc', 'staff_operationnel'];
    case 'manager_parc':
      return ['manager_parc', 'staff_operationnel'];
    default:
      return [];
  }
}

interface Gestionnaire {
  role_code: RoleUtilisateur;
  parc_ids: string[];
  parcs_manager_principal?: string[];
}

/** Le gestionnaire peut-il créer / mettre un compte avec ce rôle, ces parcs et ce badge MGR ? */
export function peutGererCompte(
  g: Gestionnaire | null | undefined,
  role: RoleUtilisateur,
  parcs: string[],
  estManager = false
): boolean {
  if (!g || !rolesAttribuables(g.role_code).includes(role)) return false;
  if (['direction', 'admin_it', 'chef_maintenance'].includes(g.role_code)) return true;
  if (parcs.length === 0 || !parcs.every((p) => g.parc_ids.includes(p))) return false;
  if (g.role_code === 'manager_parc' && estManager) {
    return parcs.every((p) => (g.parcs_manager_principal ?? []).includes(p));
  }
  return true;
}
