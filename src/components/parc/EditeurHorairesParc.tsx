import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import type { Parc, HorairesParc, HoraireJour, HoraireVacances, JourSemaine } from '@/types/database';
import { useModifierHorairesParc } from '@/hooks/queries/useReferentiel';
import { JOURS_ORDERED } from '@/lib/horaires';
import { cn } from '@/lib/utils';

const LABELS_JOURS: Record<JourSemaine, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
};

const DEFAULT_JOUR: HoraireJour = { ouverture: '10:00', fermeture: '20:00', ferme: false };
const DEFAULT_VACANCES: HoraireVacances = { ouverture: '10:00', fermeture: '20:00', tous_jours: true };

function buildDefault(): HorairesParc {
  const h = {} as HorairesParc;
  for (const j of JOURS_ORDERED) {
    h[j] = { ...DEFAULT_JOUR };
  }
  h.vacances = { ...DEFAULT_VACANCES };
  return h;
}

interface Props {
  parc: Parc;
  disabled: boolean;
}

export function EditeurHorairesParc({ parc, disabled }: Props) {
  const mutation = useModifierHorairesParc();
  const [local, setLocal] = useState<HorairesParc>(() => parc.horaires ?? buildDefault());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocal(parc.horaires ?? buildDefault());
    setDirty(false);
  }, [parc.horaires]);

  const update = useCallback((fn: (prev: HorairesParc) => HorairesParc) => {
    setLocal((prev) => fn(prev));
    setDirty(true);
  }, []);

  const handleSave = () => {
    mutation.mutate({ id: parc.id, horaires: local }, {
      onSuccess: () => setDirty(false),
    });
  };

  const vacances = local.vacances ?? DEFAULT_VACANCES;

  return (
    <div className="bg-bg-card rounded-2xl border border-white/[0.06] p-4 md:p-5">
      <h4 className="text-[14px] font-semibold mb-1">Horaires d'ouverture</h4>
      <SynchroGoogle parc={parc} />

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] text-dim uppercase tracking-wider">
              <th className="text-left pb-2 pr-3 font-medium">Jour</th>
              <th className="text-center pb-2 px-2 font-medium w-16">Fermé</th>
              <th className="text-left pb-2 px-2 font-medium">Ouverture</th>
              <th className="text-left pb-2 pl-2 font-medium">Fermeture</th>
            </tr>
          </thead>
          <tbody>
            {JOURS_ORDERED.map((jour) => {
              const h = local[jour] ?? DEFAULT_JOUR;
              return (
                <tr key={jour} className="border-t border-white/[0.04]">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{LABELS_JOURS[jour]}</td>
                  <td className="py-2 px-2 text-center">
                    <button
                      disabled={disabled}
                      onClick={() => update((prev) => ({
                        ...prev,
                        [jour]: { ...prev[jour], ferme: !h.ferme, ouverture: !h.ferme ? null : '10:00', fermeture: !h.ferme ? null : '20:00' },
                      }))}
                      className={cn(
                        'relative w-10 h-6 rounded-full transition-colors inline-block',
                        h.ferme ? 'bg-red/60' : 'bg-white/10',
                        disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                        h.ferme ? 'translate-x-[18px]' : 'translate-x-0.5'
                      )} />
                    </button>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="time"
                      value={h.ouverture ?? ''}
                      onChange={(e) => update((prev) => ({
                        ...prev,
                        [jour]: { ...prev[jour], ouverture: e.target.value || null },
                      }))}
                      disabled={disabled || h.ferme}
                      className={cn(
                        'bg-bg-app border border-white/[0.08] rounded-lg p-1.5 px-2 text-[13px] min-h-[36px] w-[100px]',
                        (h.ferme || disabled) && 'opacity-30 cursor-not-allowed'
                      )}
                    />
                  </td>
                  <td className="py-2 pl-2">
                    <input
                      type="time"
                      value={h.fermeture ?? ''}
                      onChange={(e) => update((prev) => ({
                        ...prev,
                        [jour]: { ...prev[jour], fermeture: e.target.value || null },
                      }))}
                      disabled={disabled || h.ferme}
                      className={cn(
                        'bg-bg-app border border-white/[0.08] rounded-lg p-1.5 px-2 text-[13px] min-h-[36px] w-[100px]',
                        (h.ferme || disabled) && 'opacity-30 cursor-not-allowed'
                      )}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 pt-4 border-t border-white/[0.06]">
        <h5 className="text-[13px] font-semibold mb-3">Horaires vacances scolaires</h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-dim uppercase tracking-wider block mb-1">Ouverture</label>
            <input
              type="time"
              value={vacances.ouverture}
              onChange={(e) => update((prev) => ({
                ...prev,
                vacances: { ...(prev.vacances ?? DEFAULT_VACANCES), ouverture: e.target.value },
              }))}
              disabled={disabled}
              className="bg-bg-app border border-white/[0.08] rounded-lg p-2 px-3 text-[13px] min-h-[40px] w-full"
            />
          </div>
          <div>
            <label className="text-[11px] text-dim uppercase tracking-wider block mb-1">Fermeture</label>
            <input
              type="time"
              value={vacances.fermeture}
              onChange={(e) => update((prev) => ({
                ...prev,
                vacances: { ...(prev.vacances ?? DEFAULT_VACANCES), fermeture: e.target.value },
              }))}
              disabled={disabled}
              className="bg-bg-app border border-white/[0.08] rounded-lg p-2 px-3 text-[13px] min-h-[40px] w-full"
            />
          </div>
          <div>
            <label className="text-[11px] text-dim uppercase tracking-wider block mb-1">Dernier dim. fermeture</label>
            <input
              type="time"
              value={vacances.dernier_dimanche_fermeture ?? ''}
              onChange={(e) => update((prev) => ({
                ...prev,
                vacances: {
                  ...(prev.vacances ?? DEFAULT_VACANCES),
                  dernier_dimanche_fermeture: e.target.value || undefined,
                },
              }))}
              disabled={disabled}
              className="bg-bg-app border border-white/[0.08] rounded-lg p-2 px-3 text-[13px] min-h-[40px] w-full"
            />
            <p className="text-[10px] text-dim mt-1">Optionnel</p>
          </div>
        </div>
      </div>

      {dirty && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={disabled || mutation.isPending}
            className={cn(
              'bg-gradient-cta text-text px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]',
              (disabled || mutation.isPending) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {mutation.isPending ? 'Enregistrement...' : 'Sauvegarder les horaires'}
          </button>
        </div>
      )}

      {mutation.isSuccess && !dirty && (
        <p className="text-green text-[12px] mt-2 text-right">Horaires enregistrés</p>
      )}
    </div>
  );
}

/** Horaires calés sur la fiche Google du parc : date de la dernière reprise, et reprise à la demande */
function SynchroGoogle({ parc }: { parc: Parc }) {
  const { utilisateur } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [enCours, setEnCours] = useState(false);
  const meta = parc.meta ?? {};
  const peutSynchroniser = ['chef_maintenance', 'direction', 'admin_it'].includes(utilisateur?.role_code ?? '');

  const synchroniser = async () => {
    setEnCours(true);
    const { data, error } = await supabase.functions.invoke('sync-horaires-google', { body: { force: true } });
    setEnCours(false);
    qc.invalidateQueries({ queryKey: ['parcs'] });
    if (error || data?.success === false) {
      toast.error(data?.error ?? error?.message ?? 'Synchronisation impossible');
      return;
    }
    const r = (data?.resultats ?? []) as { parc: string; statut: string; erreur?: string }[];
    const erreurs = r.filter((x) => x.statut === 'erreur');
    if (erreurs.length) toast.error(erreurs.map((x) => `${x.parc} : ${x.erreur}`).join(' · '));
    else toast.success(`Horaires repris de Google (${r.filter((x) => x.statut === 'mis_a_jour').length} parc(s) modifié(s))`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 text-[12px]">
      {meta.horaires_google_le ? (
        <span className="text-dim">
          Calés sur Google le {new Date(meta.horaires_google_le).toLocaleDateString('fr-FR')}
          {meta.horaires_google_fiche ? ` (fiche « ${meta.horaires_google_fiche} »)` : ''}
        </span>
      ) : (
        <span className="text-faint">Pas encore calés sur Google</span>
      )}
      {meta.horaires_google_erreur && <span className="text-amber">· {meta.horaires_google_erreur}</span>}
      {peutSynchroniser && (
        <button
          onClick={synchroniser}
          disabled={enCours}
          className="ml-auto bg-nikito-cyan/12 border border-nikito-cyan/45 text-nikito-cyan px-3 rounded-lg font-semibold min-h-[36px] disabled:opacity-50"
        >
          {enCours ? 'Synchronisation…' : '↻ Reprendre les horaires Google'}
        </button>
      )}
    </div>
  );
}
