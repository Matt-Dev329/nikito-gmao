import type { ControleHistorique } from '@/hooks/queries/useHistoriqueControles';

interface CompteursControlesProps {
  controles: ControleHistorique[];
}

export function CompteursControles({ controles }: CompteursControlesProps) {
  const total = controles.length;
  const valides = controles.filter((c) => c.statut === 'valide').length;
  const pctValides = total > 0 ? Math.round((valides / total) * 100) : 0;
  const nonConformites = controles.reduce((sum, c) => sum + c.nb_ko, 0);
  const totalPoints = controles.reduce((sum, c) => sum + c.nb_total, 0);
  const totalOk = controles.reduce((sum, c) => sum + c.nb_ok, 0);
  const tauxConformite = totalPoints > 0 ? Math.round((totalOk / totalPoints) * 100) : 0;

  const compteurs = [
    { label: 'Total controles', value: total, accent: 'text-nikito-cyan' },
    { label: 'Valides', value: `${valides} (${pctValides}%)`, accent: 'text-green' },
    { label: 'Non-conformites', value: nonConformites, accent: 'text-amber' },
    { label: 'Taux conformite', value: `${tauxConformite}%`, accent: tauxConformite >= 90 ? 'text-green' : tauxConformite >= 70 ? 'text-amber' : 'text-red' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {compteurs.map((c) => (
        <div key={c.label} className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
          <div className="text-[10px] text-dim uppercase tracking-wider mb-1.5">{c.label}</div>
          <div className={`text-[22px] font-bold ${c.accent}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
