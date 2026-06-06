import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'nikito-draft:';

/**
 * Persiste une saisie de formulaire dans localStorage pour éviter toute perte
 * (réseau coupé, tablette en veille, fermeture accidentelle).
 *
 * - `key` doit être stable et unique (ex. `cloture:BT-2026-0020`).
 * - `restore()` renvoie le brouillon sauvegardé (ou null).
 * - `save(valeurs)` enregistre (throttlé, sûr si localStorage indisponible).
 * - `clear()` supprime le brouillon (à appeler après envoi réussi).
 */
export function useDraftPersistence<T extends Record<string, unknown>>(key: string | null) {
  const storageKey = key ? PREFIX + key : null;
  const [hasDraft, setHasDraft] = useState(false);

  const restore = useCallback((): T | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const save = useCallback(
    (valeurs: T) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ ...valeurs, _savedAt: Date.now() }));
        setHasDraft(true);
      } catch {
        /* quota / navigation privée : on ignore silencieusement */
      }
    },
    [storageKey]
  );

  const clear = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setHasDraft(false);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      setHasDraft(localStorage.getItem(storageKey) !== null);
    } catch {
      setHasDraft(false);
    }
  }, [storageKey]);

  return { restore, save, clear, hasDraft };
}

/** Sauvegarde automatiquement `valeurs` quand elles changent (throttlé). */
export function useAutoSaveDraft<T extends Record<string, unknown>>(
  save: (v: T) => void,
  valeurs: T,
  actif: boolean
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!actif) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(valeurs), 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [save, valeurs, actif]);
}
