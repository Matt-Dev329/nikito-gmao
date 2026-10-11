import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { chargerToutesLesPages } from '@/lib/paginer';
import { useFormationFilter } from '@/hooks/useFormation';

export interface PieceStockOption {
  id: string;
  reference: string;
  nom: string;
  stock_actuel: number;
}

/** Liste légère des pièces du stock (sélecteurs : catalogue commandes, pièces utilisées). */
export function usePiecesStockOptions() {
  // En mode formation, les pièces utilisées doivent venir du stock de formation
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['pieces_detachees', 'options', estFormation],
    queryFn: () =>
      chargerToutesLesPages<PieceStockOption>((debut, fin) =>
        supabase
          .from('pieces_detachees')
          .select('id, reference, nom, stock_actuel')
          .eq('est_formation', estFormation)
          .order('nom')
          .order('id')
          .range(debut, fin)
      ),
  });
}
