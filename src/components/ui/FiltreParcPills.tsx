import { Pill } from '@/components/ui/Pill';

/**
 * Boutons de parc d'une page : « Tous les parcs » puis chaque parc présent
 * (avec son nombre). Le parc filtré reste affiché même s'il n'a rien, pour
 * qu'on voie toujours quel filtre est actif et qu'on puisse revenir à tous.
 */
export function FiltreParcPills({
  parcs,
  actif,
  total,
  onChange,
}: {
  parcs: [string, number][];
  actif: string | null;
  total?: number;
  onChange: (code: string | null) => void;
}) {
  const liste = actif && !parcs.some(([p]) => p === actif) ? [...parcs, [actif, 0] as [string, number]] : parcs;
  if (liste.length < 2 && !actif) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      <Pill active={!actif} onClick={() => onChange(null)}>
        Tous les parcs{total !== undefined && <span className="opacity-60"> · {total}</span>}
      </Pill>
      {liste.map(([p, n]) => (
        <Pill key={p} active={actif === p} onClick={() => onChange(p)}>
          {p} <span className="opacity-60">· {n}</span>
        </Pill>
      ))}
    </div>
  );
}
