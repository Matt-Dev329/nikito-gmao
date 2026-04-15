import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ============================================================
// Query hooks · KPI (vues SQL)
// ============================================================

export function useKpiPerformance() {
  return useQuery({
    queryKey: ['kpi', 'performance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vue_kpi_performance').select('*');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useKpiMtbf() {
  return useQuery({
    queryKey: ['kpi', 'mtbf'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vue_kpi_mtbf').select('*');
      if (error) throw error;
      return data;
    },
  });
}

export function useKpiMttr() {
  return useQuery({
    queryKey: ['kpi', 'mttr'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vue_kpi_mttr').select('*');
      if (error) throw error;
      return data;
    },
  });
}

export function useKpiPremierCoup() {
  return useQuery({
    queryKey: ['kpi', 'premier_coup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vue_kpi_premier_coup').select('*');
      if (error) throw error;
      return data;
    },
  });
}

export function useKpiPlaintes() {
  return useQuery({
    queryKey: ['kpi', 'plaintes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vue_kpi_plaintes').select('*');
      if (error) throw error;
      return data;
    },
  });
}

export function useRecurrencesActives() {
  return useQuery({
    queryKey: ['recurrences', 'actives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_recurrences_actives')
        .select('*')
        .order('pannes_30j', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAvancementHebdo(parcId?: string) {
  return useQuery({
    queryKey: ['kpi', 'avancement_hebdo', parcId],
    queryFn: async () => {
      let q = supabase.from('vue_avancement_hebdo').select('*');
      if (parcId) q = q.eq('parc_id', parcId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function usePerfTechnicien30j() {
  return useQuery({
    queryKey: ['kpi', 'perf_technicien'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_perf_technicien_30j')
        .select('*')
        .order('bt_clos', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
