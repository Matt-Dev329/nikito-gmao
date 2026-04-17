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
  role_code: RoleUtilisateur;
  parcs: { parc_id: string; code: string }[];
}

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
        else if (code === 'chef_maintenance' || code === 'manager_parc') compteurs.chefManager++;
        else if (code === 'technicien') compteurs.techniciens++;
        else if (code === 'staff_operationnel') compteurs.staff++;
      }
      return compteurs;
    },
  });
}

export function useUtilisateursActifs() {
  return useQuery({
    queryKey: ['utilisateurs', 'actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utilisateurs')
        .select(
          `id, email, prenom, nom, trigramme, actif, statut_validation, auth_mode, cree_le,
           roles!inner(code),
           parcs_utilisateurs(parc_id, parcs(code))`
        )
        .eq('actif', true)
        .eq('statut_validation', 'valide')
        .order('nom');
      if (error) throw error;

      return (data ?? []).map((d) => {
        const raw = d as Record<string, unknown>;
        const roles = raw.roles as { code: string };
        const pu = raw.parcs_utilisateurs as { parc_id: string; parcs: { code: string } }[];
        return {
          ...d,
          role_code: roles.code as RoleUtilisateur,
          parcs: pu.map((p) => ({ parc_id: p.parc_id, code: p.parcs.code })),
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
          `id, email, prenom, nom, trigramme, actif, statut_validation, auth_mode, cree_le,
           roles!inner(code),
           parcs_utilisateurs(parc_id, parcs(code))`
        )
        .eq('statut_validation', 'en_attente')
        .order('cree_le', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((d) => {
        const raw = d as Record<string, unknown>;
        const roles = raw.roles as { code: string };
        const pu = raw.parcs_utilisateurs as { parc_id: string; parcs: { code: string } }[];
        return {
          ...d,
          role_code: roles.code as RoleUtilisateur,
          parcs: pu.map((p) => ({ parc_id: p.parc_id, code: p.parcs.code })),
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
          `id, email, prenom, nom, trigramme, actif, statut_validation, auth_mode, cree_le,
           roles!inner(code),
           parcs_utilisateurs(parc_id, parcs(code))`
        )
        .or('actif.eq.false,statut_validation.eq.desactive')
        .order('nom');
      if (error) throw error;

      return (data ?? []).map((d) => {
        const raw = d as Record<string, unknown>;
        const roles = raw.roles as { code: string };
        const pu = raw.parcs_utilisateurs as { parc_id: string; parcs: { code: string } }[];
        return {
          ...d,
          role_code: roles.code as RoleUtilisateur,
          parcs: pu.map((p) => ({ parc_id: p.parc_id, code: p.parcs.code })),
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
