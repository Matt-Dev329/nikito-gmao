import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export interface TicketLie {
  id: string;
  numeroBT: string;
  libelle: string;
}

interface Ligne extends TicketLie {
  activite: string | null;
  titre: string | null;
}

const STATUTS_OUVERTS = ['ouvert', 'en_cours', 'en_pause'];

/**
 * Clôture groupée : autres tickets ouverts du même parc à clôturer avec le
 * même rapport (même cause, ex. 3 socles de charge pour un seul bloc de charge).
 * Ne propose que les tickets que le compte connecté voit (règles de la base).
 */
export function TicketsMemeCause({
  incidentId,
  parcId,
  activite,
  selection,
  onChange,
  desactive,
}: {
  incidentId: string;
  parcId: string | null;
  activite: string | null;
  selection: TicketLie[];
  onChange: (s: TicketLie[]) => void;
  desactive?: boolean;
}) {
  const [ouvert, setOuvert] = useState(selection.length > 0);
  const [toutLeParc, setToutLeParc] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets-meme-cause', parcId, incidentId],
    enabled: ouvert && !!parcId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('id, numero_bt, titre, equipements!inner(parc_id, code, libelle, categories_equipement(activite))')
        .eq('equipements.parc_id', parcId!)
        .in('statut', STATUTS_OUVERTS)
        .is('supprime_le', null)
        .neq('id', incidentId)
        .order('numero_bt');
      if (error) throw error;
      return ((data ?? []) as unknown as {
        id: string;
        numero_bt: string;
        titre: string | null;
        equipements: { code: string | null; libelle: string | null; categories_equipement: { activite: string | null } | null } | null;
      }[]).map<Ligne>((t) => ({
        id: t.id,
        numeroBT: t.numero_bt,
        titre: t.titre,
        libelle: [t.equipements?.code, t.equipements?.libelle].filter(Boolean).join(' · ') || t.titre || t.numero_bt,
        activite: t.equipements?.categories_equipement?.activite ?? null,
      }));
    },
  });

  const liste = useMemo(() => {
    const tous = tickets ?? [];
    if (toutLeParc || !activite) return tous;
    return tous.filter((t) => t.activite === activite);
  }, [tickets, toutLeParc, activite]);

  const coche = (t: Ligne) => selection.some((s) => s.id === t.id);
  const basculer = (t: Ligne) =>
    onChange(coche(t) ? selection.filter((s) => s.id !== t.id) : [...selection, { id: t.id, numeroBT: t.numeroBT, libelle: t.libelle }]);

  if (!parcId) return null;

  return (
    <div className={cn('rounded-xl border p-3', selection.length ? 'border-nikito-cyan/50 bg-nikito-cyan/[0.06]' : 'border-white/[0.08]')}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        disabled={desactive}
        className="w-full flex items-center justify-between gap-2 text-left min-h-[40px]"
      >
        <span className="text-[13px] font-semibold">
          🔗 Même cause : clôturer aussi d’autres tickets
          {selection.length > 0 && <span className="text-nikito-cyan"> · {selection.length} sélectionné{selection.length > 1 ? 's' : ''}</span>}
        </span>
        <span className="text-dim text-[12px]">{ouvert ? '▲' : '▼'}</span>
      </button>
      {ouvert && (
        <div className="mt-2 grid gap-2">
          <div className="text-[12px] text-dim">
            Coche les tickets réglés par la même réparation : ils seront clôturés avec ce rapport (même diagnostic, actions et photos,
            mention « même cause »). Les pièces ne sont sorties du stock qu’une fois, sur ce ticket.
          </div>
          {activite && (
            <label className="flex items-center gap-2 text-[12px] text-dim">
              <input type="checkbox" checked={toutLeParc} onChange={(e) => setToutLeParc(e.target.checked)} className="accent-nikito-cyan" />
              Voir tous les tickets ouverts du parc (pas seulement {activite})
            </label>
          )}
          {isLoading ? (
            <div className="text-[12px] text-dim">Chargement…</div>
          ) : liste.length === 0 ? (
            <div className="text-[12px] text-dim">Aucun autre ticket ouvert{activite && !toutLeParc ? ` en ${activite}` : ''} dans ce parc.</div>
          ) : (
            <div className="grid gap-1 max-h-[260px] overflow-y-auto">
              {liste.map((t) => (
                <label
                  key={t.id}
                  className={cn(
                    'flex items-start gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer border',
                    coche(t) ? 'border-nikito-cyan/50 bg-nikito-cyan/10' : 'border-transparent bg-bg-deep'
                  )}
                >
                  <input type="checkbox" checked={coche(t)} onChange={() => basculer(t)} disabled={desactive} className="accent-nikito-cyan w-4 h-4 mt-0.5" />
                  <span className="min-w-0">
                    <span className="text-[13px] font-semibold">{t.numeroBT}</span>{' '}
                    <span className="text-[13px]">{t.libelle}</span>
                    {t.titre && <span className="block text-[12px] text-dim truncate">{t.titre}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
