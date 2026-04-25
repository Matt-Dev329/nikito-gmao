import { createContext, useContext } from 'react';
import { createContext, useContext } from 'react';
import type { RoleUtilisateur } from '@/types/database';

export function canSignaler(role: RoleUtilisateur): boolean {
  return role !== 'admin_it';
}

export function hasModeExpert(role: RoleUtilisateur): boolean {
  return role === 'technicien' || role === 'chef_maintenance';
}

export type SignalerButtonVariant = 'full' | 'icon-only' | 'central-tablet' | 'hidden';

export function getSignalerButtonVariant(role: RoleUtilisateur, isTabletFixed: boolean): SignalerButtonVariant {
  if (role === 'admin_it') return 'hidden';
  if (isTabletFixed && (role === 'staff_operationnel' || role === 'technicien')) return 'central-tablet';
  if (role === 'direction') return 'icon-only';
  return 'full';

interface SignalerContextValue {
  openSignaler: () => void;
  variant: SignalerButtonVariant;
  visible: boolean;
}

export const SignalerContext = createContext<SignalerContextValue>({
  openSignaler: () => {},
  variant: 'hidden',
  visible: false,
});

export function useSignaler() {
  return useContext(SignalerContext);
}
}

interface SignalerContextValue {
  openSignaler: () => void;
  variant: SignalerButtonVariant;
  visible: boolean;
}

export const SignalerContext = createContext<SignalerContextValue>({
  openSignaler: () => {},
  variant: 'hidden',
  visible: false,
});

export function useSignaler() {
  return useContext(SignalerContext);
}
