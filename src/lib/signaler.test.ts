import { describe, it, expect } from 'vitest';
import { canSignaler, hasModeExpert, getSignalerButtonVariant } from './signaler';
import type { RoleUtilisateur } from '@/types/database';

const ROLES: RoleUtilisateur[] = [
  'direction', 'chef_maintenance', 'directeur_parc', 'manager_parc',
  'technicien', 'staff_operationnel', 'admin_it',
];

describe('canSignaler', () => {
  it('autorise tout le monde sauf admin_it', () => {
    for (const r of ROLES) {
      expect(canSignaler(r)).toBe(r !== 'admin_it');
    }
  });
});

describe('hasModeExpert', () => {
  it('réservé technicien / chef_maintenance / directeur_parc', () => {
    expect(hasModeExpert('technicien')).toBe(true);
    expect(hasModeExpert('chef_maintenance')).toBe(true);
    expect(hasModeExpert('directeur_parc')).toBe(true);
    expect(hasModeExpert('direction')).toBe(false);
    expect(hasModeExpert('manager_parc')).toBe(false);
    expect(hasModeExpert('staff_operationnel')).toBe(false);
    expect(hasModeExpert('admin_it')).toBe(false);
  });
});

describe('getSignalerButtonVariant', () => {
  it('masqué pour admin_it', () => {
    expect(getSignalerButtonVariant('admin_it', false)).toBe('hidden');
    expect(getSignalerButtonVariant('admin_it', true)).toBe('hidden');
  });
  it('central sur tablette pour staff et technicien', () => {
    expect(getSignalerButtonVariant('staff_operationnel', true)).toBe('central-tablet');
    expect(getSignalerButtonVariant('technicien', true)).toBe('central-tablet');
  });
  it('icône seule pour la direction (hors tablette)', () => {
    expect(getSignalerButtonVariant('direction', false)).toBe('icon-only');
  });
  it('bouton complet par défaut', () => {
    expect(getSignalerButtonVariant('manager_parc', false)).toBe('full');
    expect(getSignalerButtonVariant('chef_maintenance', false)).toBe('full');
  });
});
