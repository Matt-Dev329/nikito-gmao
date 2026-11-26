import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSidebarBadges } from '@/hooks/queries/useSidebarBadges';

/**
 * Alertes (cloche / onglet « Alertes ») : seules les NOUVEAUTÉS s'affichent.
 * Chaque alerte retient le nombre déjà vu (sur l'appareil) ; toucher une
 * alerte ou « Tout marquer comme vu » la retire, elle revient si le nombre
 * augmente (nouveau ticket, nouvelle commande…).
 */
export interface Alerte {
  key: string;
  label: string;
  /** Nombre de nouveautés depuis la dernière consultation */
  nouveau: number;
  /** Nombre total en cours */
  total: number;
  tone: 'red' | 'amber';
  to: string;
}

const CLE = 'notif_bell_seen';
const EVT = 'alba:alertes-vues';

function lireVues(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CLE);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function ecrireVues(v: Record<string, number>) {
  try {
    localStorage.setItem(CLE, JSON.stringify(v));
  } catch {
    // stockage indisponible : l'état reste en mémoire
  }
  window.dispatchEvent(new Event(EVT));
}

export function useAlertesVues() {
  const { data: badges } = useSidebarBadges();
  const [vues, setVues] = useState(lireVues);

  useEffect(() => {
    const maj = () => setVues(lireVues());
    window.addEventListener(EVT, maj);
    window.addEventListener('storage', maj);
    return () => {
      window.removeEventListener(EVT, maj);
      window.removeEventListener('storage', maj);
    };
  }, []);

  const toutes = useMemo(() => {
    if (!badges) return [] as Omit<Alerte, 'nouveau'>[];
    const l: Omit<Alerte, 'nouveau'>[] = [];
    const ajouter = (key: string, label: string, total: number, tone: 'red' | 'amber', to: string) => {
      if (total > 0) l.push({ key, label, total, tone, to });
    };
    ajouter('controlesManquants', 'Contrôles manquants', badges.controlesManquants, 'red', '/staff/controle-ouverture');
    ajouter('operations', 'Incidents ouverts', badges.operations, 'red', '/gmao/operations');
    ajouter('interventionsEnCours', 'Interventions en cours', badges.interventionsEnCours, 'red', '/gmao/operations');
    ajouter('commandesATraiter', 'Commandes à traiter', badges.commandesATraiter, 'amber', '/gmao/commander?onglet=a_traiter');
    ajouter('recurrences', 'Récurrences détectées', badges.recurrences, 'red', '/gmao/recurrences');
    ajouter('cinqPourquoi', 'Fiches 5P ouvertes', badges.cinqPourquoi, 'amber', '/gmao/cinq-pourquoi');
    ajouter('invitationsPending', 'Invitations en attente', badges.invitationsPending, 'amber', '/gmao/utilisateurs');
    return l;
  }, [badges]);

  // Nombre en baisse (tickets fermés…) : le « déjà vu » suit, pour que les
  // prochaines nouveautés réapparaissent bien
  useEffect(() => {
    if (!badges) return;
    const v = lireVues();
    let change = false;
    for (const key of Object.keys(v)) {
      const total = toutes.find((a) => a.key === key)?.total ?? 0;
      if (v[key] > total) {
        v[key] = total;
        change = true;
      }
    }
    if (change) ecrireVues(v);
  }, [badges, toutes]);

  const nouvelles: Alerte[] = useMemo(
    () =>
      toutes
        .map((a) => ({ ...a, nouveau: Math.max(0, a.total - (vues[a.key] ?? 0)) }))
        .filter((a) => a.nouveau > 0),
    [toutes, vues]
  );

  const marquerVue = useCallback(
    (key: string) => {
      const total = toutes.find((a) => a.key === key)?.total ?? 0;
      ecrireVues({ ...lireVues(), [key]: total });
    },
    [toutes]
  );

  const toutMarquerVu = useCallback(() => {
    const v = lireVues();
    for (const a of toutes) v[a.key] = a.total;
    ecrireVues(v);
  }, [toutes]);

  const totalNouveau = nouvelles.reduce((n, a) => n + a.nouveau, 0);
  return { nouvelles, totalNouveau, marquerVue, toutMarquerVu };
}
