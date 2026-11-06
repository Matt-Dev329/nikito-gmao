import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface DemandeEnCours {
  id: string;
  parc_id: string;
  type: 'intervention' | 'specifique';
  prestataire: string | null;
  domaine: string | null;
  objet: string;
  description: string | null;
  urgente: boolean;
  date_souhaitee: string | null;
  date_prevue: string | null;
  statut: 'a_envoyer' | 'envoyee' | 'planifiee';
  cree_le: string;
  parc: { code: string; nom: string } | null;
  auteur: { prenom: string; nom: string } | null;
}

/** Demandes spécifiques et d'intervention prestataire encore en cours (à envoyer, envoyées, planifiées) */
export function useDemandesEnCours(actif: boolean) {
  return useQuery({
    queryKey: ['demandes-prestataires', 'en-cours'],
    enabled: actif,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandes_prestataires')
        .select('id, parc_id, type, prestataire, domaine, objet, description, urgente, date_souhaitee, date_prevue, statut, cree_le, parc:parcs(code, nom), auteur:utilisateurs!demandes_prestataires_cree_par_id_fkey(prenom, nom)')
        .eq('actif', true)
        .in('statut', ['a_envoyer', 'envoyee', 'planifiee'])
        .order('urgente', { ascending: false })
        .order('cree_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DemandeEnCours[];
    },
  });
}
