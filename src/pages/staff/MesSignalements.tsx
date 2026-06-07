import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { CritTag } from '@/components/ui/CritTag';
import { formatHeure, cn } from '@/lib/utils';
import type { Criticite } from '@/types/database';

interface SignalementJour {
  id: string;
  numero_bt: string;
  titre: string;
  description: string | null;
  statut: string;
  declare_le: string;
  equipement_libelle: string | null;
  equipement_code: string | null;
  parc_nom: string | null;
  priorite_nom: string | null;
  priorite_code: string | null;
}

function getStaffUserId(): string | null {
  try {
    const raw = sessionStorage.getItem('staff_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.utilisateur?.utilisateur_id ?? s?.utilisateur?.id ?? null;
  } catch {
    return null;
  }
}

function mapCriticite(code: string | null): Criticite {
  if (code === 'bloquant') return 'bloquant';
  if (code === 'majeur') return 'majeur';
  return 'mineur';
}

const statutLabel: Record<string, string> = {
  ouvert: 'Ouvert',
  assigne: 'Assigné',
  en_cours: 'En cours',
  en_pause: 'En pause',
  resolu: 'Résolu',
  ferme: 'Fermé',
  annule: 'Annulé',
};

export function MesSignalements() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const userId = utilisateur?.id ?? getStaffUserId();

  const { data, isLoading } = useQuery({
    queryKey: ['mes-signalements-jour', userId],
    queryFn: async () => {
      if (!userId) return [] as SignalementJour[];
      const { data, error } = await supabase.rpc('incidents_du_jour_utilisateur', { p_user_id: userId });
      if (error) throw error;
      return (data ?? []) as SignalementJour[];
    },
    enabled: !!userId,
  });

  const signalements = data ?? [];

  return (
    <div className="min-h-screen bg-bg-app text-text p-4 md:p-6 md:px-7 max-w-[820px] mx-auto">
      <button onClick={() => navigate(-1)} className="text-nikito-cyan text-sm mb-3">
        &lsaquo; Retour
      </button>
      <h1 className="text-[22px] font-semibold m-0">Mes signalements du jour</h1>
      <div className="text-[13px] text-dim mt-1 mb-4">
        {signalements.length} signalement{signalements.length > 1 ? 's' : ''} aujourd'hui
      </div>

      {isLoading ? (
        <div className="text-dim text-sm animate-pulse py-8 text-center">Chargement…</div>
      ) : !userId ? (
        <div className="text-dim text-sm py-8 text-center">Session introuvable — reconnecte-toi.</div>
      ) : signalements.length === 0 ? (
        <div className="text-dim text-sm py-8 text-center">Aucun signalement déclaré aujourd'hui.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {signalements.map((s) => (
            <div key={s.id} className="bg-bg-card rounded-xl p-3.5 px-4 flex items-center gap-3">
              <CritTag niveau={mapCriticite(s.priorite_code)} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {s.equipement_libelle ?? s.titre}
                </div>
                <div className="text-[11px] text-dim font-mono">
                  {s.numero_bt}
                  {s.equipement_code ? ` · ${s.equipement_code}` : ''}
                  {s.parc_nom ? ` · ${s.parc_nom}` : ''} · {formatHeure(s.declare_le)}
                </div>
              </div>
              <span
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-lg whitespace-nowrap',
                  s.statut === 'resolu' || s.statut === 'ferme'
                    ? 'bg-green/20 text-green'
                    : s.statut === 'en_cours'
                    ? 'bg-amber/20 text-amber'
                    : 'bg-white/10 text-dim'
                )}
              >
                {statutLabel[s.statut] ?? s.statut}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
