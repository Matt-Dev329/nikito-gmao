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
