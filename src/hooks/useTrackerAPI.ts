import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { VehiculePosition } from './queries/useFlotte';

export interface TrackerPosition {
  tracker_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  battery: number;
  engine_on: boolean;
  timestamp: string;
}

export function useTrackerPosition(vehiculeId: string | undefined) {
  return useQuery({
    queryKey: ['tracker-position', vehiculeId],
    enabled: !!vehiculeId,
    queryFn: async (): Promise<VehiculePosition | null> => {
      const { data } = await supabase
        .from('vehicules_positions')
        .select('*')
        .eq('vehicule_id', vehiculeId!)
        .order('enregistre_le', { ascending: false })
        .limit(1)
        .maybeSingle();

      return (data as VehiculePosition) ?? null;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useTrackerHistory(vehiculeId: string | undefined, dateDebut?: string, dateFin?: string) {
  return useQuery({
    queryKey: ['tracker-history', vehiculeId, dateDebut, dateFin],
    enabled: !!vehiculeId,
    queryFn: async (): Promise<VehiculePosition[]> => {
      let query = supabase
        .from('vehicules_positions')
        .select('*')
        .eq('vehicule_id', vehiculeId!)
        .order('enregistre_le', { ascending: true });

      if (dateDebut) query = query.gte('enregistre_le', dateDebut);
      if (dateFin) query = query.lte('enregistre_le', dateFin);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as VehiculePosition[];
    },
    staleTime: 30_000,
  });
}
