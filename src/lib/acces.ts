import type { RoleUtilisateur } from '@/types/database';

/**
 * Onglet Stock : réservé aux techniciens et directeurs de parc
 * (+ le gestionnaire des commandes, géré à part car c'est une personne, pas un rôle).
 */
export const ROLES_STOCK: RoleUtilisateur[] = ['directeur_parc', 'technicien'];

export function peutVoirStock(role: RoleUtilisateur | undefined, estGestionnaireCommandes: boolean): boolean {
  return estGestionnaireCommandes || (!!role && ROLES_STOCK.includes(role));
}
