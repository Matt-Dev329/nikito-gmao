import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Parc } from '@/types/database';
import { getHorairesAujourdhui, getHeureAlerte, getMinutesDuJour } from '@/lib/horaires';

const CHECK_INTERVAL_MS = 60_000;

interface AlerteParc {
  parc: Parc;
  ouverture: string;
  estVacances: boolean;
  alerteAppMin: number;
  alerteSmsMin: number;
}

async function fetchParcsActifs(): Promise<Parc[]> {
  const { data, error } = await supabase
    .from('parcs')
    .select('*')
    .eq('actif', true)
    .neq('code', 'ECO');
  if (error) throw error;
  return (data ?? []) as Parc[];
}

async function fetchControlesValidesCeJour(today: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('controles')
    .select('parc_id')
    .eq('type', 'quotidien')
    .eq('date_planifiee', today)
    .eq('statut', 'valide')
    .eq('est_formation', false);
  if (error) throw error;
  return new Set((data ?? []).map((c) => c.parc_id));
}

async function fetchAlertesDejaCreees(today: string): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabase
    .from('notifications_controle_manquant')
    .select('parc_id, type_alerte')
    .eq('date_controle', today);
  if (error) throw error;

  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    if (!map.has(row.parc_id)) map.set(row.parc_id, new Set());
    map.get(row.parc_id)!.add(row.type_alerte);
  }
  return map;
}

async function creerAlerte(
  parcId: string,
  type: 'app' | 'sms',
  heureAlerte: string,
  heureOuverture: string,
  estVacances: boolean
) {
  const { error } = await supabase
    .from('notifications_controle_manquant')
    .upsert(
      {
        parc_id: parcId,
        date_controle: new Date().toISOString().slice(0, 10),
        type_alerte: type,
        heure_alerte: heureAlerte,
        heure_ouverture: heureOuverture,
        est_vacances: estVacances,
        sms_envoye: false,
      },
      { onConflict: 'parc_id,date_controle,type_alerte' }
    );
  if (error) {
    console.error(`[ControlesManquantsCheck] Erreur création alerte ${type} pour parc ${parcId}:`, error);
  }
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function runCheck(queryClient: ReturnType<typeof useQueryClient>) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const minutesDuJour = getMinutesDuJour(now);

  const parcs = await fetchParcsActifs();
  const controlesValides = await fetchControlesValidesCeJour(today);
  const alertesExistantes = await fetchAlertesDejaCreees(today);

  const alertes: AlerteParc[] = [];

  for (const parc of parcs) {
    if (controlesValides.has(parc.id)) continue;

    const horaires = getHorairesAujourdhui(parc, now);
    if (horaires.ferme || !horaires.ouverture) continue;

    const { alerteApp, alerteSms } = getHeureAlerte(horaires.ouverture);
    alertes.push({
      parc,
      ouverture: horaires.ouverture,
      estVacances: horaires.estVacances,
      alerteAppMin: alerteApp,
      alerteSmsMin: alerteSms,
    });
  }

  let changement = false;

  for (const a of alertes) {
    const dejaCreees = alertesExistantes.get(a.parc.id) ?? new Set();

    if (minutesDuJour >= a.alerteAppMin && !dejaCreees.has('app')) {
      console.log(
        `[ControlesManquantsCheck] ALERTE APP - ${a.parc.code} : contrôle manquant (ouverture ${a.ouverture}, alerte à ${minutesToHHMM(a.alerteAppMin)}, vacances=${a.estVacances})`
      );
      await creerAlerte(a.parc.id, 'app', minutesToHHMM(a.alerteAppMin), a.ouverture, a.estVacances);
      changement = true;
    }

    if (minutesDuJour >= a.alerteSmsMin && !dejaCreees.has('sms')) {
      console.log(
        `[ControlesManquantsCheck] ALERTE SMS - ${a.parc.code} : contrôle manquant (ouverture ${a.ouverture}, SMS à ${minutesToHHMM(a.alerteSmsMin)}, vacances=${a.estVacances})`
      );
      await creerAlerte(a.parc.id, 'sms', minutesToHHMM(a.alerteSmsMin), a.ouverture, a.estVacances);
      console.log(`[ControlesManquantsCheck] SMS envoi simulé pour ${a.parc.code} - ${a.parc.nom}`);
      changement = true;
    }
  }

  if (changement) {
    queryClient.invalidateQueries({ queryKey: ['controles_manquants'] });
    queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] });
  }
}

export function useControlesManquantsCheck() {
  const { utilisateur } = useAuth();
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!utilisateur) return;

    const doCheck = () => {
      runCheck(queryClient).catch((err) => {
        console.error('[ControlesManquantsCheck] Erreur lors de la vérification:', err);
      });
    };

    doCheck();

    intervalRef.current = setInterval(doCheck, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [utilisateur, queryClient]);
}
