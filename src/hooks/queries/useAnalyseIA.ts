import { useState, useCallback, useRef, useEffect } from 'react';
import { useFormationFilter } from '@/hooks/useFormation';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import type { AnalyseIA, AnalyseIACachee, MaintenanceData } from '@/types/ia-predictive';

const CACHE_PREFIX = 'alba_ia_predictive_cache';
const CACHE_DURATION = 6 * 60 * 60 * 1000;

function getCacheKey(estFormation: boolean) {
  return `${CACHE_PREFIX}_${estFormation ? 'formation' : 'production'}`;
}

function getCache(estFormation: boolean): AnalyseIACachee | null {
  try {
    const raw = localStorage.getItem(getCacheKey(estFormation));
    if (!raw) return null;
    const parsed: AnalyseIACachee = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_DURATION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCache(estFormation: boolean, analyse: AnalyseIA) {
  const cached: AnalyseIACachee = { timestamp: Date.now(), analyse };
  localStorage.setItem(getCacheKey(estFormation), JSON.stringify(cached));
}

function hasMinimumData(data: MaintenanceData): boolean {
  const hasEquipements = data.equipements.length > 0;
  const hasIncidents = data.equipements.some(
    (e) => e.incidents_total > 0 || e.recurrences > 0
  );
  return hasEquipements && hasIncidents;
}

export function useAnalyseIA() {
  const { estFormation } = useFormationFilter();
  const cached = getCache(estFormation);
  const [analyse, setAnalyse] = useState<AnalyseIA | null>(cached?.analyse ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyse, setLastAnalyse] = useState<Date | null>(
    cached ? new Date(cached.timestamp) : null
  );

  const prevFormation = useRef(estFormation);
  useEffect(() => {
    if (prevFormation.current !== estFormation) {
      prevFormation.current = estFormation;
      const c = getCache(estFormation);
      if (c) {
        setAnalyse(c.analyse);
        setLastAnalyse(new Date(c.timestamp));
        setError(null);
      } else {
        setAnalyse(null);
        setLastAnalyse(null);
        setError(null);
      }
    }
  }, [estFormation]);

  const lancer = useCallback(async (data: MaintenanceData, force = false) => {
    if (!force) {
      const c = getCache(estFormation);
      if (c) {
        setAnalyse(c.analyse);
        setLastAnalyse(new Date(c.timestamp));
        return c.analyse;
      }
    }

    if (!data.equipements.length) {
      setError('Pas assez de donnees pour une analyse predictive. Commencez par enregistrer des controles et des incidents.');
      return null;
    }

    if (!hasMinimumData(data)) {
      setError('Pas assez de donnees pour une analyse predictive. Aucun incident ou recurrence enregistre.');
      return null;
    }

    setLoading(true);
    setError(null);

    const apiUrl = `${supabaseUrl}/functions/v1/analyse-ia-predictive`;

    try {
      console.log('[IA] Appel edge function:', apiUrl);
      console.log('[IA] Equipements:', data.equipements.length, '| Parcs:', data.parcs.length);
      console.log('[IA] Taille payload:', JSON.stringify(data).length, 'chars');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ maintenance_data: data }),
      });

      console.log('[IA] Response status:', response.status, response.statusText);

      const rawText = await response.text();
      console.log('[IA] Response raw (500 chars):', rawText.substring(0, 500));

      let responseData: Record<string, unknown>;
      try {
        responseData = JSON.parse(rawText);
      } catch {
        throw new Error(`Reponse non-JSON (${response.status}): ${rawText.substring(0, 200)}`);
      }

      console.log('[IA] Response body:', JSON.stringify(responseData).substring(0, 500));

      if (!response.ok) {
        throw new Error(`Edge function error ${response.status}: ${JSON.stringify(responseData)}`);
      }

      if (responseData.success === false) {
        const detail = responseData.detail ? ` — ${responseData.detail}` : '';
        throw new Error(`${responseData.error}${detail}`);
      }

      const ia = responseData.analysis as AnalyseIA;
      if (!ia) {
        throw new Error('Reponse IA vide (pas de champ analysis)');
      }

      setAnalyse(ia);
      setCache(estFormation, ia);
      setLastAnalyse(new Date());
      return ia;
    } catch (err) {
      console.error('[IA] Erreur complete:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Erreur inconnue');
      return null;
    } finally {
      setLoading(false);
    }
  }, [estFormation]);

  return { analyse, loading, error, lastAnalyse, lancer };
}
