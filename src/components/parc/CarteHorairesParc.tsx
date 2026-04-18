import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Parc, JourSemaine } from '@/types/database';
import { useFormationFilter } from '@/hooks/useFormation';
import {
  getHorairesAujourdhui,
  getHorairesSemaine,
  getJourSemaine,
  formatHeure,
  getHeureAlerte,
  getMinutesDuJour,
} from '@/lib/horaires';
import { cn } from '@/lib/utils';

const LABELS: Record<JourSemaine, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
};

interface Props {
  parc: Parc;
}

export function CarteHorairesParc({ parc }: Props) {
  const { estFormation } = useFormationFilter();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const jourActuel = getJourSemaine(now);
  const horairesAujourdhui = getHorairesAujourdhui(parc, now);
  const minutesDuJour = getMinutesDuJour(now);

  const semaine = useMemo(() => getHorairesSemaine(parc, now), [parc, now]);

  const { data: controleAujourdhui } = useQuery({
    queryKey: ['controle_ouverture_parc', parc.id, today, estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles')
        .select('id, date_validation, realise_par_nom')
        .eq('parc_id', parc.id)
        .eq('type', 'quotidien')
        .eq('date_planifiee', today)
        .eq('statut', 'valide')
        .eq('est_formation', estFormation)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: controlesSemaine } = useQuery({
    queryKey: ['controles_semaine_parc', parc.id, today, estFormation],
    queryFn: async () => {
      const lundi = new Date(now);
      const dayOfWeek = lundi.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      lundi.setDate(lundi.getDate() + diffToMonday);
      const dimanche = new Date(lundi);
      dimanche.setDate(lundi.getDate() + 6);

      const { data, error } = await supabase
        .from('controles')
        .select('date_planifiee, statut')
        .eq('parc_id', parc.id)
        .eq('type', 'quotidien')
        .eq('est_formation', estFormation)
        .gte('date_planifiee', lundi.toISOString().slice(0, 10))
        .lte('date_planifiee', dimanche.toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
  });

  const controlesSemaineMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of controlesSemaine ?? []) {
      m.set(c.date_planifiee, c.statut);
    }
    return m;
  }, [controlesSemaine]);

  const jourLabel = jourActuel.charAt(0).toUpperCase() + jourActuel.slice(1);

  let statutControle: 'fait' | 'attente' | 'alerte' | 'ferme' = 'attente';
  let statutMessage = '';

  if (horairesAujourdhui.ferme) {
    statutControle = 'ferme';
    statutMessage = 'Parc fermé — pas de contrôle requis';
  } else if (controleAujourdhui) {
    statutControle = 'fait';
    const heureValid = controleAujourdhui.date_validation
      ? new Date(controleAujourdhui.date_validation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';
    statutMessage = `Contrôle réalisé à ${heureValid} par ${controleAujourdhui.realise_par_nom ?? 'inconnu'}`;
  } else if (horairesAujourdhui.ouverture) {
    const { alerteApp } = getHeureAlerte(horairesAujourdhui.ouverture);
    if (minutesDuJour >= alerteApp) {
      statutControle = 'alerte';
      statutMessage = 'CONTROLE NON FAIT';
    } else {
      statutMessage = `En attente (requis avant ${formatHeure(horairesAujourdhui.ouverture)})`;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-bg-card rounded-2xl border border-white/[0.06] p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-[14px] font-semibold">Horaires aujourd'hui</h3>
            <p className="text-[13px] mt-1">
              {horairesAujourdhui.ferme ? (
                <span className="text-dim">Aujourd'hui ({jourLabel.toLowerCase()}) : Fermé</span>
              ) : (
                <span className="text-text">
                  Aujourd'hui ({jourLabel.toLowerCase()}) : Ouvert de{' '}
                  <span className="font-semibold text-nikito-cyan">{formatHeure(horairesAujourdhui.ouverture)}</span>
                  {' '}à{' '}
                  <span className="font-semibold text-nikito-cyan">{formatHeure(horairesAujourdhui.fermeture)}</span>
                  {horairesAujourdhui.estDernierDimancheVacances && (
                    <span className="text-amber text-[12px] ml-1">(dernier dimanche de vacances)</span>
                  )}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {horairesAujourdhui.estVacances && (
              <span className="bg-nikito-cyan/15 text-nikito-cyan px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap">
                Vacances scolaires
              </span>
            )}
            {horairesAujourdhui.ferme ? (
              <span className="bg-white/5 text-dim px-2 py-0.5 rounded-md text-[10px] font-bold">
                Fermé
              </span>
            ) : (
              <span className="bg-green/15 text-green px-2 py-0.5 rounded-md text-[10px] font-bold">
                Ouvert
              </span>
            )}
          </div>
        </div>

        <div className="mt-1">
          <p className="text-[11px] text-dim uppercase tracking-wider mb-1.5">Statut controle d'ouverture</p>
          <div className={cn(
            'rounded-xl px-3.5 py-2.5 text-[12px] font-medium flex items-center gap-2',
            statutControle === 'fait' && 'bg-green/10 text-green',
            statutControle === 'attente' && 'bg-amber/10 text-amber',
            statutControle === 'alerte' && 'bg-red/10 text-red animate-pulse',
            statutControle === 'ferme' && 'bg-white/5 text-dim'
          )}>
            <span className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              statutControle === 'fait' && 'bg-green',
              statutControle === 'attente' && 'bg-amber',
              statutControle === 'alerte' && 'bg-red',
              statutControle === 'ferme' && 'bg-white/20'
            )} />
            {statutMessage}
          </div>
        </div>
      </div>

      <div className="bg-bg-card rounded-2xl border border-white/[0.06] p-4 md:p-5">
        <h4 className="text-[13px] font-semibold mb-3">Semaine en cours</h4>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] text-dim uppercase tracking-wider">
                <th className="text-left pb-2 pr-2 font-medium">Jour</th>
                <th className="text-left pb-2 px-2 font-medium">Horaires</th>
                <th className="text-left pb-2 pl-2 font-medium">Contrôle</th>
              </tr>
            </thead>
            <tbody>
              {semaine.map(({ jour, date, horaires: h }) => {
                const dateStr = date.toISOString().slice(0, 10);
                const estAujourdhui = dateStr === today;
                const estPasse = date < new Date(today + 'T00:00:00');
                const ctrl = controlesSemaineMap.get(dateStr);
                const estFutur = !estAujourdhui && !estPasse;

                let ctrlCell: React.ReactNode;
                if (h.ferme) {
                  ctrlCell = <span className="text-dim">—</span>;
                } else if (ctrl === 'valide') {
                  ctrlCell = <span className="text-green font-medium">Fait</span>;
                } else if (estAujourdhui) {
                  ctrlCell = <span className="text-amber font-medium">En attente</span>;
                } else if (estFutur) {
                  ctrlCell = <span className="text-dim">—</span>;
                } else {
                  ctrlCell = <span className="text-red font-medium">Manquant</span>;
                }

                return (
                  <tr key={jour} className={cn(
                    'border-t border-white/[0.04]',
                    estAujourdhui && 'bg-white/[0.02]'
                  )}>
                    <td className={cn('py-2 pr-2 whitespace-nowrap', estAujourdhui && 'font-semibold text-nikito-cyan')}>
                      {LABELS[jour]}
                      {estAujourdhui && <span className="text-[10px] text-dim ml-1">(auj.)</span>}
                    </td>
                    <td className="py-2 px-2">
                      {h.ferme ? (
                        <span className="text-dim">Fermé</span>
                      ) : (
                        <span>{formatHeure(h.ouverture)}-{formatHeure(h.fermeture)}</span>
                      )}
                    </td>
                    <td className="py-2 pl-2">{ctrlCell}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
