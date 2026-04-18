import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Vehicule {
  id: string;
  code: string;
  libelle: string;
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
  parc_id: string | null;
  assigne_a_id: string | null;
  tracker_id: string | null;
  tracker_type: string | null;
  statut: 'actif' | 'maintenance' | 'hors_service';
  photo_url: string | null;
  km_actuel: number;
  date_derniere_revision: string | null;
  date_prochaine_revision: string | null;
  cree_le: string;
  modifie_le: string;
  assignee?: { nom: string; prenom: string } | null;
  parc?: { nom: string; code: string } | null;
}

export interface VehiculePosition {
  id: string;
  vehicule_id: string;
  latitude: number;
  longitude: number;
  vitesse: number;
  cap: number | null;
  altitude: number | null;
  batterie_tracker: number | null;
  moteur_allume: boolean;
  adresse: string | null;
  enregistre_le: string;
}

export interface VehiculeAvecPosition extends Vehicule {
  derniere_position: VehiculePosition | null;
}

export type FiltreStatutVehicule = 'tous' | 'en_route' | 'stationne' | 'hors_service';

export function useVehicules() {
  return useQuery({
    queryKey: ['vehicules'],
    queryFn: async (): Promise<Vehicule[]> => {
      const { data, error } = await supabase
        .from('vehicules')
        .select(`
          *,
          assignee:utilisateurs!vehicules_assigne_a_id_fkey(nom, prenom),
          parc:parcs!vehicules_parc_id_fkey(nom, code)
        `)
        .order('code', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as Vehicule[];
    },
    staleTime: 30_000,
  });
}

export function useVehiculesAvecPositions() {
  const { data: vehicules, isLoading: loadingV, error: errorV } = useVehicules();
  const { data: positions, isLoading: loadingP, error: errorP } = useDernieresPositions();

  const vehiculesAvecPos: VehiculeAvecPosition[] = (vehicules ?? []).map((v) => ({
    ...v,
    derniere_position: positions?.find((p) => p.vehicule_id === v.id) ?? null,
  }));

  return {
    data: vehiculesAvecPos,
    isLoading: loadingV || loadingP,
    error: errorV || errorP,
  };
}

export function useDernieresPositions() {
  return useQuery({
    queryKey: ['vehicules-positions-latest'],
    queryFn: async (): Promise<VehiculePosition[]> => {
      const { data: vehicules } = await supabase
        .from('vehicules')
        .select('id');

      if (!vehicules || vehicules.length === 0) return [];

      const results: VehiculePosition[] = [];
      for (const v of vehicules) {
        const { data } = await supabase
          .from('vehicules_positions')
          .select('*')
          .eq('vehicule_id', v.id)
          .order('enregistre_le', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) results.push(data as VehiculePosition);
      }

      return results;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useHistoriquePositions(vehiculeId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['vehicule-historique', vehiculeId, limit],
    enabled: !!vehiculeId,
    queryFn: async (): Promise<VehiculePosition[]> => {
      const { data, error } = await supabase
        .from('vehicules_positions')
        .select('*')
        .eq('vehicule_id', vehiculeId!)
        .order('enregistre_le', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as VehiculePosition[];
    },
    staleTime: 15_000,
  });
}

export function useAjouterVehicule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      code: string;
      libelle: string;
      immatriculation?: string;
      marque?: string;
      modele?: string;
      parc_id?: string;
      assigne_a_id?: string;
      tracker_id?: string;
      photo_url?: string;
    }) => {
      const { data, error } = await supabase
        .from('vehicules')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicules'] });
    },
  });
}

export function useModifierVehicule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Vehicule>) => {
      const { error } = await supabase
        .from('vehicules')
        .update({ ...payload, modifie_le: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicules'] });
    },
  });
}

export function useInsererPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pos: Omit<VehiculePosition, 'id' | 'enregistre_le'> & { enregistre_le?: string }) => {
      const { error } = await supabase
        .from('vehicules_positions')
        .insert(pos);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicules-positions-latest'] });
      queryClient.invalidateQueries({ queryKey: ['vehicule-historique'] });
    },
  });
}

export function getStatutVehicule(pos: VehiculePosition | null, vehicule: Vehicule): 'en_route' | 'stationne' | 'attention' | 'hors_service' {
  if (vehicule.statut === 'hors_service') return 'hors_service';
  if (!pos) return 'stationne';
  if (pos.batterie_tracker != null && pos.batterie_tracker < 20) return 'attention';
  if (pos.moteur_allume && pos.vitesse > 0) return 'en_route';
  return 'stationne';
}
