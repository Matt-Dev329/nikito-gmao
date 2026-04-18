import { useState, useEffect } from 'react';
import type { Parc, ParcMeta } from '@/types/database';
import { useModifierMetaParc } from '@/hooks/queries/useReferentiel';
import { cn } from '@/lib/utils';

interface Props {
  parc: Parc;
  disabled: boolean;
}

export function ToggleVacancesParc({ parc, disabled }: Props) {
  const mutation = useModifierMetaParc();
  const meta = parc.meta ?? {};
  const [estVacances, setEstVacances] = useState(meta.est_vacances ?? false);
  const [dateFin, setDateFin] = useState(meta.date_fin_vacances ?? '');

  useEffect(() => {
    setEstVacances(parc.meta?.est_vacances ?? false);
    setDateFin(parc.meta?.date_fin_vacances ?? '');
  }, [parc.meta]);

  const handleToggle = () => {
    const next = !estVacances;
    setEstVacances(next);
    const newMeta: ParcMeta = next
      ? { est_vacances: true, date_fin_vacances: dateFin || undefined }
      : { est_vacances: false };
    mutation.mutate({ id: parc.id, meta: newMeta });
  };

  const handleDateChange = (val: string) => {
    setDateFin(val);
    if (estVacances) {
      mutation.mutate({ id: parc.id, meta: { est_vacances: true, date_fin_vacances: val || undefined } });
    }
  };

  return (
    <div className="bg-bg-card rounded-2xl border border-white/[0.06] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-[14px] font-semibold">Période vacances scolaires</h4>
          <p className="text-[12px] text-dim mt-0.5">
            Active les horaires vacances pour ce parc
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={disabled || mutation.isPending}
          className={cn(
            'relative w-12 h-7 rounded-full transition-colors flex-shrink-0',
            estVacances ? 'bg-nikito-cyan' : 'bg-white/10',
            (disabled || mutation.isPending) && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
              estVacances ? 'translate-x-[22px]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {estVacances && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <label className="text-[12px] text-dim uppercase tracking-wider block mb-1.5">
            Date de fin des vacances
          </label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => handleDateChange(e.target.value)}
            disabled={disabled || mutation.isPending}
            className="bg-bg-app border border-white/[0.08] rounded-[10px] p-2.5 px-3.5 text-text text-[13px] min-h-[44px] w-full"
          />
          {!dateFin && (
            <p className="text-amber text-[11px] mt-1.5">
              Sans date de fin, le dernier dimanche de vacances ne sera pas détecté
            </p>
          )}
        </div>
      )}
    </div>
  );
}
