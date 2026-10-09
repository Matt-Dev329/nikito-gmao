import type { RoleUtilisateur } from '@/types/database';

/**
 * Onglet Stock : accès inchangé pour l'instant (phase de test sur le compte du
 * gestionnaire des commandes). Cible validée à appliquer ensuite :
 * ['directeur_parc', 'technicien'] + le gestionnaire des commandes.
 */
export const ROLES_STOCK: RoleUtilisateur[] = ['direction', 'chef_maintenance', 'directeur_parc', 'technicien', 'admin_it'];

export function peutVoirStock(role: RoleUtilisateur | undefined, estGestionnaireCommandes: boolean): boolean {
  return estGestionnaireCommandes || (!!role && ROLES_STOCK.includes(role));
}
