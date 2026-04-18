import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';
import type { AnalyseIA, AnalyseIACachee, MaintenanceData } from '@/types/ia-predictive';

const env = (import.meta as unknown as { env: Record<string, string> }).env;

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

    const hasData = data.equipements.length > 0;
    if (!hasData) {
      setError('Pas assez de donnees pour une analyse predictive. Commencez par enregistrer des controles et des incidents.');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const url = `${env.VITE_SUPABASE_URL}/functions/v1/analyse-ia-predictive`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ maintenance_data: data }),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Erreur inconnue');
      }

      const ia = result.analysis as AnalyseIA;
      setAnalyse(ia);
      setCache(estFormation, ia);
      setLastAnalyse(new Date());
      return ia;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`L'analyse IA a echoue : ${msg}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [estFormation]);

  return { analyse, loading, error, lastAnalyse, lancer };
}
