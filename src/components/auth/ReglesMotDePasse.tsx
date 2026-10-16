import { cn } from '@/lib/utils';
import { reglesMotDePasse } from '@/lib/motDePasse';

/** Liste des règles du mot de passe, cochées au fil de la saisie. */
export function ReglesMotDePasse({ motDePasse }: { motDePasse: string }) {
  return (
    <ul className="mt-2 grid gap-0.5 text-[11px]">
      {reglesMotDePasse(motDePasse).map((r) => (
        <li key={r.libelle} className={cn(r.ok ? 'text-green' : 'text-dim')}>
          {r.ok ? '✓' : '○'} {r.libelle}
        </li>
      ))}
    </ul>
  );
}
