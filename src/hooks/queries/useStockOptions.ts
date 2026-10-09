import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PieceStockOption {
  id: string;
  reference: string;
  nom: string;
  stock_actuel: number;
}

/** Liste légère des pièces du stock (sélecteurs : catalogue commandes, pièces utilisées). */
export function usePiecesStockOptions() {
  return useQuery({
    queryKey: ['pieces_detachees', 'options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pieces_detachees')
        .select('id, reference, nom, stock_actuel')
        .eq('est_formation', false)
        .order('nom');
      if (error) throw error;
      return (data ?? []) as PieceStockOption[];
    },
  });
}
