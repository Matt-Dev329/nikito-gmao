import type { RoleUtilisateur } from '@/types/database';

/**
 * Onglet Stock : visible par tous les rôles internes (hors staff), qui peuvent
 * tous faire des sorties. Les entrées et la création de pièces sont réservées
 * à ROLES_ENTREE_STOCK + gestionnaires des commandes (cf RPC mouvement_stock).
 */
export const ROLES_STOCK: RoleUtilisateur[] = ['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'];

export const ROLES_ENTREE_STOCK: RoleUtilisateur[] = ['direction', 'chef_maintenance', 'admin_it'];

export function peutEntrerStock(role: RoleUtilisateur | undefined, estGestionnaireCommandes: boolean): boolean {
  return estGestionnaireCommandes || (!!role && ROLES_ENTREE_STOCK.includes(role));
}

export function peutVoirStock(role: RoleUtilisateur | undefined, estGestionnaireCommandes: boolean): boolean {
  return estGestionnaireCommandes || (!!role && ROLES_STOCK.includes(role));
}

/** Rapports et analyses prestataires : chef d'équipe et directeurs de parc */
export const ROLES_PRESTATAIRES = ['chef_maintenance', 'directeur_parc'];

/** Formations du personnel */
export const ROLES_FORMATIONS = ['direction', 'chef_maintenance', 'directeur_parc', 'admin_it'];
