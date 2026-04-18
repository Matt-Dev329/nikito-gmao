import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';

export function useKpiPerformance() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['kpi', 'performance', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_kpi_performance')
        .select('*')
        .eq('est_formation', estFormation);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useKpiMtbf() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['kpi', 'mtbf', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_kpi_mtbf')
        .select('*')
        .eq('est_formation', estFormation);
      if (error) throw error;
      return data;
    },
  });
}

export function useKpiMttr() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['kpi', 'mttr', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_kpi_mttr')
        .select('*')
        .eq('est_formation', estFormation);
      if (error) throw error;
      return data;
    },
  });
}

export function useKpiPremierCoup() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['kpi', 'premier_coup', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_kpi_premier_coup')
        .select('*')
        .eq('est_formation', estFormation);
      if (error) throw error;
      return data;
    },
  });
}

export function useKpiPlaintes() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['kpi', 'plaintes', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_kpi_plaintes')
        .select('*')
        .eq('est_formation', estFormation);
      if (error) throw error;
      return data;
    },
  });
}

export function useRecurrencesActives() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['recurrences', 'actives', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_recurrences_actives')
        .select('*')
        .eq('est_formation', estFormation)
        .order('pannes_30j', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAvancementHebdo(parcId?: string) {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['kpi', 'avancement_hebdo', parcId, estFormation],
    queryFn: async () => {
      let q = supabase
        .from('vue_avancement_hebdo')
        .select('*')
        .eq('est_formation', estFormation);
      if (parcId) q = q.eq('parc_id', parcId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function usePerfTechnicien30j() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['kpi', 'perf_technicien', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_perf_technicien_30j')
        .select('*')
        .eq('est_formation', estFormation)
        .order('bt_clos', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
