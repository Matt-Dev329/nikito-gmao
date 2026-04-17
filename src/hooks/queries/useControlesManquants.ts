import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ControleManquant {
  parc_id: string;
  parc_code: string;
  parc_nom: string;
}

export function useControlesOuvertureManquants() {
  const now = new Date();
  const heure = now.getHours();
  const today = now.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['controles_manquants', today],
    queryFn: async () => {
      const { data: parcs, error: errParcs } = await supabase
        .from('parcs')
        .select('id, code, nom')
        .eq('actif', true);
      if (errParcs) throw errParcs;
      if (!parcs?.length) return [];

      const { data: controles, error: errCtrl } = await supabase
        .from('controles')
        .select('parc_id')
        .eq('type', 'quotidien')
        .eq('date_planifiee', today)
        .eq('statut', 'valide');
      if (errCtrl) throw errCtrl;

      const parcsAvecControle = new Set((controles ?? []).map((c) => c.parc_id));

      return parcs
        .filter((p) => !parcsAvecControle.has(p.id))
        .map((p) => ({
          parc_id: p.id,
          parc_code: p.code,
          parc_nom: p.nom,
        })) as ControleManquant[];
    },
    enabled: heure >= 10,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });
}
