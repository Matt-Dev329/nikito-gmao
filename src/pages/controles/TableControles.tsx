import { cn } from '@/lib/utils';
import type { ControleHistorique } from '@/hooks/queries/useHistoriqueControles';
import type { TypeControle, StatutControle } from '@/types/database';

const typeLabel: Record<TypeControle, string> = {
  quotidien: 'Quotidien',
  hebdo: 'Hebdo',
  mensuel: 'Mensuel',
};

const typeBg: Record<TypeControle, string> = {
  quotidien: 'bg-nikito-cyan/15 text-nikito-cyan',
  hebdo: 'bg-nikito-pink/15 text-nikito-pink',
  mensuel: 'bg-amber/15 text-amber',
};

const statutLabel: Record<StatutControle, string> = {
  a_faire: 'A faire',
  en_cours: 'En cours',
  valide: 'Valide',
  echec: 'Echec',
  remplace: 'Remplace',
};

const statutStyle: Record<string, string> = {
  valide: 'bg-green/15 text-green',
  en_cours: 'bg-amber/15 text-amber',
  echec: 'bg-red/15 text-red',
  remplace: 'bg-dim/15 text-dim',
  a_faire: 'bg-dim/10 text-dim',
};

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuree(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return '-';
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  if (ms < 0) return '-';
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

interface TableControlesProps {
  controles: ControleHistorique[];
  onVoir: (id: string) => void;
}

export function TableControles({ controles, onVoir }: TableControlesProps) {
  if (controles.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
        <div className="text-dim text-sm">Aucun controle trouve pour cette periode.</div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block bg-bg-card rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Date', 'Parc', 'Type', 'Controleur', 'Statut', 'OK', 'KO', 'Duree', ''].map((h) => (
                <th key={h} className="text-[10px] text-dim uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {controles.map((c) => (
              <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-[13px] whitespace-nowrap">{formatDate(c.date_planifiee)}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-nikito-cyan text-[13px] font-semibold">{c.parc_code}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold', typeBg[c.type])}>
                    {typeLabel[c.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px]">{c.realise_par_nom ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold', statutStyle[c.statut] ?? statutStyle.a_faire)}>
                    {c.statut === 'remplace' ? 'Remplace' : statutLabel[c.statut] ?? c.statut}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px] text-green font-medium">{c.nb_ok}</td>
                <td className="px-4 py-3 text-[13px] text-red font-medium">{c.nb_ko}</td>
                <td className="px-4 py-3 text-[13px] text-dim">{formatDuree(c.date_demarrage, c.date_validation)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onVoir(c.id)}
                    className="text-nikito-cyan text-[12px] font-medium hover:underline min-h-[44px] px-2"
                  >
                    Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex flex-col gap-2.5">
        {controles.map((c) => (
          <button
            key={c.id}
            onClick={() => onVoir(c.id)}
            className="bg-bg-card rounded-xl p-4 border border-white/[0.06] text-left w-full"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-nikito-cyan text-[13px] font-semibold">{c.parc_code}</span>
              <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold', statutStyle[c.statut] ?? statutStyle.a_faire)}>
                {c.statut === 'remplace' ? 'Remplace' : statutLabel[c.statut] ?? c.statut}
              </span>
            </div>
            <div className="text-[13px] font-medium mb-1">{formatDate(c.date_planifiee)}</div>
            <div className="flex items-center gap-3 text-[12px] text-dim">
              <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold', typeBg[c.type])}>
                {typeLabel[c.type]}
              </span>
              <span>{c.realise_par_nom ?? '-'}</span>
              <span className="ml-auto">
                <span className="text-green">{c.nb_ok} OK</span> / <span className="text-red">{c.nb_ko} KO</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
