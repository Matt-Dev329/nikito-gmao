import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RoleUtilisateur } from '@/types/database';

export interface UtilisateurRow {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  trigramme: string | null;
  actif: boolean;
  statut_validation: string;
  auth_mode: string;
  cree_le: string;
  role_id: string;
  role_code: RoleUtilisateur;
  parcs: { parc_id: string; code: string; est_manager: boolean }[];
  /** Date du dernier code PIN généré (staff) ; null = jamais */
  code_pin_genere_le?: string | null;
  /** Techniciens : Arcade (arcades seulement), Nikito (sans arcade) ou polyvalent */
  profil_technicien?: ProfilTechnicien;
  /** Non-technicien autorisé à intervenir sur les tickets de ses parcs */
  peut_intervenir?: boolean;
}

export type ProfilTechnicien = 'polyvalent' | 'arcade' | 'nikito';

export const PROFILS_TECHNICIEN: { code: ProfilTechnicien; label: string; detail: string }[] = [
  { code: 'polyvalent', label: 'Polyvalent', detail: 'Tout, sur ses parcs' },
  { code: 'arcade', label: 'Technicien Arcade', detail: 'Uniquement les arcades' },
  { code: 'nikito', label: 'Technicien Nikito', detail: 'Tout sauf les arcades' },
];

export interface InvitationRow {
  id: string;
  token: string;
  email: string | null;
  prenom: string;
  nom: string;
  role_code: RoleUtilisateur;
  auth_mode: string;
  invite_le: string;
  expire_le: string;
  parcs_assignes: string[];
}

export interface CompteursRoles {
  direction: number;
  chefManager: number;
  techniciens: number;
  staff: number;
}

export function useCompteursRoles() {
  return useQuery({
    queryKey: ['utilisateurs', 'compteurs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utilisateurs')
        .select('roles!inner(code)')
        .eq('actif', true)
        .eq('statut_validation', 'valide');
      if (error) throw error;

      const compteurs: CompteursRoles = { direction: 0, chefManager: 0, techniciens: 0, staff: 0 };
      for (const row of data ?? []) {
        const code = (row.roles as unknown as { code: string }).code;
        if (code === 'direction') compteurs.direction++;
        else if (code === 'chef_maintenance' || code === 'directeur_parc' || code === 'manager_parc') compteurs.chefManager++;
        else if (code === 'technicien') compteurs.techniciens++;
        else if (code === 'staff_operationnel') compteurs.staff++;
      }
      return compteurs;
    },
  });
}

type LienParc = { parc_id: string; est_manager: boolean; parcs: { code: string } | null };

// Un directeur / manager ne voit pas les parcs qui ne sont pas les siens : ces
// liens arrivent sans code (parcs = null) et ne sont pas affichés
function parcsVisibles(pu: LienParc[] | null) {
  return (pu ?? [])
    .filter((p) => p.parcs)
    .map((p) => ({ parc_id: p.parc_id, code: p.parcs!.code, est_manager: p.est_manager }));
}

export function useUtilisateursActifs() {
  return useQuery({
    queryKey: ['utilisateurs', 'actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utilisateurs')
        .select(
          `id, email, prenom, nom, trigramme, actif, statut_validation, auth_mode, cree_le, role_id, profil_technicien, peut_intervenir, code_pin_genere_le,
           roles!inner(code),
           parcs_utilisateurs(parc_id, est_manager, parcs(code))`
        )
        .eq('actif', true)
        .eq('statut_validation', 'valide')
        .order('nom');
      if (error) throw error;

      return (data ?? []).map((d) => {
        const raw = d as Record<string, unknown>;
        const roles = raw.roles as { code: string };
        const pu = raw.parcs_utilisateurs as LienParc[];
        return {
          ...d,
          role_code: roles.code as RoleUtilisateur,
          parcs: parcsVisibles(pu),
        } as UtilisateurRow;
      });
    },
  });
}

export function useUtilisateursAValider() {
  return useQuery({
    queryKey: ['utilisateurs', 'a_valider'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utilisateurs')
        .select(
          `id, email, prenom, nom, trigramme, actif, statut_validation, auth_mode, cree_le, role_id, profil_technicien, peut_intervenir,
           roles!inner(code),
           parcs_utilisateurs(parc_id, est_manager, parcs(code))`
        )
        .eq('statut_validation', 'en_attente')
        .order('cree_le', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((d) => {
        const raw = d as Record<string, unknown>;
        const roles = raw.roles as { code: string };
        const pu = raw.parcs_utilisateurs as LienParc[];
        return {
          ...d,
          role_code: roles.code as RoleUtilisateur,
          parcs: parcsVisibles(pu),
        } as UtilisateurRow;
      });
    },
  });
}

export function useUtilisateursDesactives() {
  return useQuery({
    queryKey: ['utilisateurs', 'desactives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utilisateurs')
        .select(
          `id, email, prenom, nom, trigramme, actif, statut_validation, auth_mode, cree_le, role_id, profil_technicien, peut_intervenir,
           roles!inner(code),
           parcs_utilisateurs(parc_id, est_manager, parcs(code))`
        )
        .or('actif.eq.false,statut_validation.eq.desactive')
        .order('nom');
      if (error) throw error;

      return (data ?? []).map((d) => {
        const raw = d as Record<string, unknown>;
        const roles = raw.roles as { code: string };
        const pu = raw.parcs_utilisateurs as LienParc[];
        return {
          ...d,
          role_code: roles.code as RoleUtilisateur,
          parcs: parcsVisibles(pu),
        } as UtilisateurRow;
      });
    },
  });
}

export function useInvitationsEnCours() {
  return useQuery({
    queryKey: ['invitations', 'en_cours'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, token, email, prenom, nom, auth_mode, invite_le, expire_le, parcs_assignes, roles!inner(code)')
        .is('utilise_le', null)
        .gt('expire_le', new Date().toISOString())
        .order('invite_le', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((d) => {
        const raw = d as Record<string, unknown>;
        const roles = raw.roles as { code: string };
        return {
          ...d,
          role_code: roles.code as RoleUtilisateur,
        } as InvitationRow;
      });
    },
  });
}

export function useAnnulerInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invitations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}

export function useSupprimerUtilisateur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ actif: false, statut_validation: 'desactive' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilisateurs'] });
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, code, nom')
        .order('nom');
      if (error) throw error;
      return data as { id: string; code: RoleUtilisateur; nom: string }[];
    },
  });
}

export function useDefinirPeutIntervenir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ utilisateur_id, autorise }: { utilisateur_id: string; autorise: boolean }) => {
      const { error } = await supabase.rpc('definir_peut_intervenir', { p_utilisateur_id: utilisateur_id, p_autorise: autorise });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilisateurs'] });
    },
  });
}

export function useDefinirProfilTechnicien() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ utilisateur_id, profil }: { utilisateur_id: string; profil: ProfilTechnicien }) => {
      const { error } = await supabase.rpc('definir_profil_technicien', { p_utilisateur_id: utilisateur_id, p_profil: profil });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilisateurs'] });
    },
  });
}

export function useModifierUtilisateur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      utilisateur_id: string;
      role_id: string;
      parc_ids: string[];
      est_manager: boolean;
      actif: boolean;
    }) => {
      const { error } = await supabase.rpc('modifier_utilisateur', {
        p_utilisateur_id: payload.utilisateur_id,
        p_role_id: payload.role_id,
        p_parc_ids: payload.parc_ids,
        p_est_manager: payload.est_manager,
        p_actif: payload.actif,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilisateurs'] });
    },
  });
}

export function useReactiverUtilisateur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('utilisateurs')
        .update({ actif: true, statut_validation: 'valide' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilisateurs'] });
    },
  });
}
