import { useEffect, useState } from 'react';

/**
 * Indique si le navigateur est en ligne. Réagit aux événements online/offline.
 * Utilisé pour prévenir l'utilisateur et protéger les saisies sur le terrain
 * (réseau instable dans les parcs).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
