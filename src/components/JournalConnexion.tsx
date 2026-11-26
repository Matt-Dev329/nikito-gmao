import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

function appareil(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablette';
  if (/iPhone|Android|Mobile/i.test(ua)) return 'téléphone';
  return 'ordinateur';
}

/**
 * Journal des connexions (onglet Stats) : une entrée par ouverture d'ALBA,
 * au plus toutes les 30 minutes (limite tenue en base). Comptes et staff PIN.
 */
export function JournalConnexion() {
  const { utilisateur } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    if (utilisateur?.id) {
      void supabase.rpc('noter_connexion', { p_appareil: appareil() }).then(() => undefined);
      return;
    }
    try {
      const raw = sessionStorage.getItem('staff_session');
      const id = raw ? (JSON.parse(raw) as { utilisateur?: { utilisateur_id?: string; id?: string } }).utilisateur : null;
      const staffId = id?.utilisateur_id ?? id?.id;
      if (staffId) void supabase.rpc('noter_connexion_staff', { p_utilisateur: staffId, p_appareil: appareil() }).then(() => undefined);
    } catch {
      // session staff illisible : rien à noter
    }
    // pathname : la session staff apparaît après la saisie du code PIN
  }, [utilisateur?.id, pathname.startsWith('/staff')]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
