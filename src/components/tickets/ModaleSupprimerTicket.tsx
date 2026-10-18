import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { useSupprimerTicket } from '@/hooks/queries/useTickets';

/** Suppression d'un ticket : le motif est obligatoire (gardé avec le ticket annulé). */
export function ModaleSupprimerTicket({
  incidentId,
  numeroBT,
  onClose,
  onSupprime,
}: {
  incidentId: string;
  numeroBT: string;
  onClose: () => void;
  onSupprime?: () => void;
}) {
  const toast = useToast();
  const supprimer = useSupprimerTicket();
  const [motif, setMotif] = useState('');
  const valide = motif.trim().length >= 5;

  const confirmer = () => {
    if (!valide) return;
    supprimer.mutate(
      { incidentId, motif: motif.trim() },
      {
        onSuccess: () => {
          toast.success(`Ticket ${numeroBT} supprimé`);
          onClose();
          onSupprime?.();
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[460px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-red/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-semibold mb-1">Supprimer le ticket {numeroBT}</div>
        <div className="text-[12px] text-dim mb-3">
          Le motif est obligatoire. Le ticket est annulé et conservé avec ce motif.
        </div>
        <textarea
          autoFocus
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={3}
          placeholder="Motif de la suppression (doublon, erreur de saisie, déjà réparé…)"
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text outline-none focus:border-red/50"
        />
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim">
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={!valide || supprimer.isPending}
            className={cn(
              'px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] bg-red text-text',
              (!valide || supprimer.isPending) && 'opacity-40'
            )}
          >
            {supprimer.isPending ? 'Suppression…' : 'Supprimer le ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
