import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { dateParis } from '@/lib/dates';
import { useFormationFilter } from '@/hooks/useFormation';

/** Rapport de réparation : intervention clôturée sur un ticket (équipe ou intervenant extérieur). */
export interface Rapport {
  cle: string;
  incident_id: string;
  numero_bt: string;
  activite: string;
  categorie: string | null;
  equipement: string | null;
  equipement_code: string | null;
  parc_code: string | null;
  parc_nom: string | null;
  zone: string | null;
  criticite: string | null;
  intervenant: string | null;
  externe: boolean;
  debut: string | null;
  fin: string;
  diagnostic: string | null;
  actions: string | null;
  resolu_premier_coup: boolean | null;
  photos_avant: string[];
  photos_apres: string[];
  pieces: { nom: string; reference: string; quantite: number }[];
}

export function useRapports(jours: number) {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['rapports-reparation', jours, estFormation],
    queryFn: async () => {
      const depuis = dateParis(Date.now() - jours * 86_400_000);
      const { data, error } = await supabase.rpc('rapports_reparation', { p_depuis: depuis, p_formation: estFormation });
      if (error) throw error;
      return (data ?? []) as Rapport[];
    },
  });
}
