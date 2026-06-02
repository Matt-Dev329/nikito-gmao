import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMettreEnPauseIncident } from '@/hooks/queries/useTickets';

interface Props {
  incidentId: string;
  numeroBT: string;
  onClose: () => void;
}

export function ModalePauseTicket({ incidentId, numeroBT, onClose }: Props) {
  const pause = useMettreEnPauseIncident();
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    setErreur(null);
    try {
      await pause.mutateAsync({ incidentId, motif: motif.trim() || null });
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la mise en pause');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[480px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Mettre en pause</div>
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
          Motif (facultatif)
        </label>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Ex: Attente piece detachee, indisponibilite..."
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[90px]"
        />

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
            disabled={pause.isPending}
            className={cn(
              'bg-amber text-bg-app px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              pause.isPending && 'opacity-40 cursor-not-allowed'
            )}
          >
            {pause.isPending ? 'Mise en pause...' : 'Mettre en pause'}
          </button>
        </div>
      </div>
    </div>
  );
}
