import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTechniciens, useReassignerIncident } from '@/hooks/queries/useTickets';

interface Props {
  incidentId: string;
  numeroBT: string;
  onClose: () => void;
}

export function ModaleReassignerTicket({ incidentId, numeroBT, onClose }: Props) {
  const { data: techniciens, isLoading } = useTechniciens();
  const reassigner = useReassignerIncident();
  const [technicienId, setTechnicienId] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    if (!technicienId) return;
    setErreur(null);
    try {
      await reassigner.mutateAsync({ incidentId, nouveauTechnicienId: technicienId });
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la reassignation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[480px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/20 p-5 md:p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Reassigner</div>
            <div className="text-[18px] font-semibold mt-0.5">Ticket {numeroBT}</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            x
          </button>
        </div>

        <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
          Nouveau technicien
        </label>
        <select
          value={technicienId}
          onChange={(e) => setTechnicienId(e.target.value)}
          disabled={isLoading}
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
        >
          <option value="">{isLoading ? 'Chargement...' : 'Selectionner'}</option>
          {(techniciens ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.prenom} {t.nom}{t.trigramme ? ` (${t.trigramme})` : ''}
            </option>
          ))}
        </select>

        {erreur && (
          <div className="text-red text-[12px] mt-3 bg-red/10 rounded-lg p-3">{erreur}</div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end mt-5">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={valider}
            disabled={!technicienId || reassigner.isPending}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!technicienId || reassigner.isPending) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {reassigner.isPending ? 'Reassignation...' : 'Reassigner'}
          </button>
        </div>
      </div>
    </div>
  );
}
