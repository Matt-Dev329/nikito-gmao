import { cn } from '@/lib/utils';

interface ModaleQuitterSansValiderProps {
  open: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
}

export function ModaleQuitterSansValider({ open, onConfirmer, onAnnuler }: ModaleQuitterSansValiderProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onAnnuler} />
      <div className="relative bg-bg-card rounded-2xl p-6 max-w-[340px] w-full border border-white/[0.08] shadow-2xl">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-amber/15 flex items-center justify-center mx-auto mb-3">
            <span className="text-amber text-xl">!</span>
          </div>
          <h3 className="text-[15px] font-semibold mb-1.5">Quitter sans valider ?</h3>
          <p className="text-[13px] text-dim leading-relaxed">
            Les saisies en cours seront sauvegard{'\u00e9'}es en brouillon.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={onAnnuler}
            className={cn(
              'flex-1 py-3 rounded-xl text-[13px] font-semibold',
              'bg-bg-deep border border-white/[0.08] text-dim hover:text-text transition-colors'
            )}
          >
            Rester
          </button>
          <button
            onClick={onConfirmer}
            className={cn(
              'flex-1 py-3 rounded-xl text-[13px] font-semibold',
              'bg-gradient-danger text-text'
            )}
          >
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
}
