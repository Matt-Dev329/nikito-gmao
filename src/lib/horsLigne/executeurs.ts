import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { cloturerIntervention, type CloturerInterventionParams } from '@/hooks/mutations/useCloturerIntervention';
import { declarerExecuteur } from './file';

/** Paramètres de la RPC valider_controle_staff, tels qu'envoyés en ligne. */
export interface PayloadControleStaff {
  p_parc_id: string;
  p_type: string;
  p_date_planifiee: string;
  p_realise_par_id: string;
  p_realise_par_nom: string;
  p_realise_par_role: string;
  p_items: unknown[];
}

export interface PayloadClotureIntervention {
  params: CloturerInterventionParams;
  utilisateurId: string;
}

export async function validerControleStaff(payload: PayloadControleStaff): Promise<string> {
  const { data, error } = await supabase.rpc('valider_controle_staff', payload);
  if (error) throw error;
  return data as string;
}

/** Création d'un incident via l'edge function de signalement. */
export async function envoyerSignalement(payload: unknown): Promise<{
  numero_bt: string;
  priorite_code: string;
  validation_manager: string | null;
}> {
  const res = await fetch(`${supabaseUrl}/functions/v1/creer-incident-signalement`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? 'Erreur inconnue');
  return data;
}

let declares = false;

/** Déclare comment rejouer chaque type d'action hors-ligne (appelé au démarrage). */
export function declarerExecuteursHorsLigne(): void {
  if (declares) return;
  declares = true;

  declarerExecuteur('cloture_intervention', async (p) => {
    const { params, utilisateurId } = p as PayloadClotureIntervention;
    await cloturerIntervention(params, utilisateurId);
  });

  // Un refus (ex. « Contrôle déjà validé ») reste visible dans la file : la saisie n'est pas perdue en silence
  declarerExecuteur('controle_staff', async (p) => {
    await validerControleStaff(p as PayloadControleStaff);
  });

  declarerExecuteur('signalement', async (p) => {
    await envoyerSignalement(p);
  });
}
