import { useState, useCallback, useRef, useEffect } from 'react';
import { useFormationFilter } from '@/hooks/useFormation';
import type { AnalyseIA, AnalyseIACachee, MaintenanceData } from '@/types/ia-predictive';

const CACHE_PREFIX = 'alba_ia_predictive_cache';
const CACHE_DURATION = 6 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `Tu es un expert en maintenance prédictive pour des parcs de loisirs indoor (trampolines, laser game, arcades, soft play).
Tu analyses les données de maintenance et tu retournes des prédictions et recommandations structurées.

Retourne UNIQUEMENT un JSON valide (pas de texte avant ou après, pas de backticks) avec cette structure exacte :

{
  "score_sante_global": number (0-100),
  "tendance": "stable" | "amelioration" | "degradation",
  "equipements_a_risque": [
    {
      "equipement_id": "string",
      "equipement_code": "string",
      "equipement_libelle": "string",
      "parc": "string",
      "score_risque": number (0-100, 100 = très risqué),
      "prediction": "string",
      "justification": "string",
      "action_recommandee": "string",
      "priorite": "haute" | "moyenne" | "basse",
      "date_panne_estimee": "YYYY-MM-DD"
    }
  ],
  "alertes": [
    {
      "type": "garantie_expiration" | "controle_manquant" | "stock_critique" | "certification_expiration" | "tendance_degradation",
      "message": "string",
      "parc": "string",
      "priorite": "haute" | "moyenne" | "basse"
    }
  ],
  "recommandations": [
    {
      "titre": "string",
      "description": "string",
      "impact_estime": "string",
      "cout_estime": "string",
      "deadline_suggeree": "YYYY-MM-DD"
    }
  ],
  "kpi_predictions": {
    "mtbf_prevu_30j": number,
    "incidents_prevus_30j": number,
    "taux_conformite_prevu": number,
    "equipements_necessitant_attention": number
  }
}

Règles :
- Trie les équipements à risque par score_risque décroissant
- Ne retourne que les équipements avec un risque réel (score > 40)
- Sois précis et factuel dans les justifications
- Base tes prédictions sur les tendances des données
- Les dates de panne estimées doivent être réalistes (dans les 30 prochains jours)
- Limite à 10 équipements à risque max, 10 alertes max, 5 recommandations max`;

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

    try {
      const userMessage = `Voici les données de maintenance des 90 derniers jours au format JSON :\n\n${JSON.stringify(data, null, 2)}`;

      console.log('[IA] Appel API Anthropic...');
      console.log('[IA] Taille payload:', JSON.stringify(data).length, 'chars');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      console.log('[IA] Response status:', response.status);

      const responseData = await response.json();
      console.log('[IA] Response data:', JSON.stringify(responseData).substring(0, 500));

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${JSON.stringify(responseData)}`);
      }

      const text = responseData.content?.[0]?.text ?? '';
      if (!text) {
        throw new Error('Reponse IA vide');
      }

      const cleaned = text.replace(/```json|```/g, '').trim();
      const ia = JSON.parse(cleaned) as AnalyseIA;

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
