import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';
import type { MaintenanceData, MaintenanceEquipementData, MaintenanceParcsData } from '@/types/ia-predictive';

async function fetchMaintenanceData(estFormation: boolean): Promise<MaintenanceData> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();

  const [
    equipRes,
    incidentsRes,
    recurrencesRes,
    perfRes,
    stockRes,
  ] = await Promise.all([
    supabase
      .from('equipements')
      .select('id, code, libelle, parc_id, statut, date_mise_service, date_fin_garantie, a_surveiller, parcs(code, nom)')
      .neq('statut', 'archive')
      .eq('est_formation', estFormation),
    supabase
      .from('incidents')
      .select('id, equipement_id, declare_le, statut')
      .gte('declare_le', d90)
      .eq('est_formation', estFormation),
    supabase
      .from('vue_recurrences_actives')
      .select('*')
      .eq('est_formation', estFormation),
    supabase
      .from('vue_kpi_performance')
      .select('*')
      .eq('est_formation', estFormation),
    supabase
      .from('pieces_detachees')
      .select('id, nom, stock_actuel, stock_min')
      .eq('est_formation', estFormation),
  ]);

  const equipements = (equipRes.data ?? []) as Array<Record<string, unknown>>;
  const incidents = (incidentsRes.data ?? []) as Array<Record<string, unknown>>;
  const recurrences = (recurrencesRes.data ?? []) as Array<Record<string, unknown>>;
  const performances = (perfRes.data ?? []) as Array<Record<string, unknown>>;
  const stock = (stockRes.data ?? []) as Array<Record<string, unknown>>;

  const incidentsByEquip = new Map<string, Array<Record<string, unknown>>>();
  for (const inc of incidents) {
    const eqId = inc.equipement_id as string;
    if (!incidentsByEquip.has(eqId)) incidentsByEquip.set(eqId, []);
    incidentsByEquip.get(eqId)!.push(inc);
  }

  const recurrencesByEquip = new Map<string, Record<string, unknown>>();
  for (const rec of recurrences) {
    recurrencesByEquip.set(rec.equipement_id as string, rec);
  }

  const incidentsOuvertsByParc = new Map<string, number>();
  for (const inc of incidents) {
    const s = inc.statut as string;
    if (s === 'ouvert' || s === 'assigne' || s === 'en_cours') {
      const eq = equipements.find((e) => e.id === inc.equipement_id);
      if (eq) {
        const pid = eq.parc_id as string;
        incidentsOuvertsByParc.set(pid, (incidentsOuvertsByParc.get(pid) ?? 0) + 1);
      }
    }
  }

  const stockCritiqueCount = stock.filter(
    (s) => (s.stock_actuel as number) < (s.stock_min as number)
  ).length;

  const equipementsData: MaintenanceEquipementData[] = equipements.map((eq) => {
    const eqId = eq.id as string;
    const eqIncidents = incidentsByEquip.get(eqId) ?? [];
    const rec = recurrencesByEquip.get(eqId);
    const parc = eq.parcs as Record<string, unknown> | null;

    const inc30 = eqIncidents.filter((i) => new Date(i.declare_le as string).getTime() >= new Date(d30).getTime()).length;
    const inc60 = eqIncidents.filter((i) => new Date(i.declare_le as string).getTime() >= new Date(d60).getTime()).length;

    return {
      equipement_id: eqId,
      code: eq.code as string,
      libelle: eq.libelle as string,
      parc_code: (parc?.code as string) ?? '',
      parc_nom: (parc?.nom as string) ?? '',
      statut: eq.statut as string,
      date_mise_service: eq.date_mise_service as string | null,
      date_fin_garantie: eq.date_fin_garantie as string | null,
      a_surveiller: eq.a_surveiller as boolean,
      incidents_total: eqIncidents.length,
      incidents_30j: inc30,
      incidents_60j: inc60,
      incidents_90j: eqIncidents.length,
      recurrences: rec ? (rec.pannes_30j as number) : 0,
      pannes_30j: rec ? (rec.pannes_30j as number) : 0,
    };
  });

  const parcIds = [...new Set(equipements.map((e) => e.parc_id as string))];
  const parcsData: MaintenanceParcsData[] = parcIds.map((pid) => {
    const eq = equipements.find((e) => e.parc_id === pid);
    const parc = eq?.parcs as Record<string, unknown> | null;
    const perf = performances.find((p) => p.parc_id === pid);

    return {
      parc_id: pid,
      parc_code: (parc?.code as string) ?? '',
      parc_nom: (parc?.nom as string) ?? '',
      performance_pct: (perf?.performance_pct as number) ?? 100,
      incidents_ouverts: incidentsOuvertsByParc.get(pid) ?? 0,
      stock_critique: stockCritiqueCount,
    };
  });

  return {
    equipements: equipementsData,
    parcs: parcsData,
    date_analyse: now.toISOString(),
  };
}

export function useMaintenanceData() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['ia-predictive', 'maintenance-data', estFormation],
    queryFn: () => fetchMaintenanceData(estFormation),
    staleTime: 5 * 60_000,
  });
}
