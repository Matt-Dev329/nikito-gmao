import { useTachesAValider, useValiderTache } from '@/hooks/useTachesAValider';
import { useToast } from '@/components/ui/ToastProvider';
import { cn } from '@/lib/utils';

function jourEcheance(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

/** Liste des tâches à valider avec bouton « Valider » (notifications et haut des Opérations) */
export function TachesAValider({ variante = 'liste' }: { variante?: 'liste' | 'bandeau' }) {
  const { data: taches } = useTachesAValider();
  const valider = useValiderTache();
  const toast = useToast();
  if (!taches?.length) return null;

  return (
    <div className={cn(variante === 'bandeau' && 'mb-4 flex flex-col gap-2')}>
      {variante === 'liste' && <div className="px-3 py-1.5 text-[10px] text-faint uppercase tracking-wider">À valider</div>}
      {taches.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3',
            variante === 'bandeau'
              ? 'bg-amber/10 border border-amber/30 rounded-xl px-3.5 py-2.5'
              : 'px-3 py-2'
          )}
        >
          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-text font-medium">{t.libelle}</div>
            <div className="text-[11px] text-dim">{jourEcheance(t.echeance)}</div>
          </div>
          <button
            disabled={valider.isPending}
            onClick={() =>
              valider.mutate(t.id, {
                onSuccess: () => toast.success(`« ${t.libelle} » validé`),
                onError: (e) => toast.error((e as Error).message),
              })
            }
            className="flex-shrink-0 bg-green/15 text-green border border-green/30 rounded-lg px-3 min-h-[36px] text-[12px] font-semibold disabled:opacity-50"
          >
            ✓ Valider
          </button>
        </div>
      ))}
    </div>
  );
}
