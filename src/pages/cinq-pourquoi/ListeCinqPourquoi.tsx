import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFiches5P } from '@/hooks/queries/useFiches5P';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { ModaleCreerFiche5P } from '@/pages/cinq-pourquoi/ModaleCreerFiche5P';
import type { Fiche5PourquoiAvecJoins, Statut5Pourquoi } from '@/types/database';

const STATUTS_FILTRE: Array<{ value: Statut5Pourquoi | 'tous'; label: string }> = [
  { value: 'tous', label: 'Tous' },
  { value: 'ouvert', label: 'Ouvert' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'cloture', label: 'Cloture' },
];

const STATUT_BADGE: Record<Statut5Pourquoi, { label: string; cls: string }> = {
  ouvert: { label: 'Ouvert', cls: 'bg-red/15 text-red' },
  en_cours: { label: 'En cours', cls: 'bg-amber/15 text-amber' },
  cloture: { label: 'Cloture', cls: 'bg-green/15 text-green' },
};

function countPourquoi(f: Fiche5PourquoiAvecJoins) {
  return [f.pourquoi_1, f.pourquoi_2, f.pourquoi_3, f.pourquoi_4, f.pourquoi_5]
    .filter((v) => v && v.trim().length > 0).length;
}

export function ListeCinqPourquoi() {
  const navigate = useNavigate();
  const { data: fiches, isLoading } = useFiches5P();
  const { data: parcs } = useParcs();
  const [statutFilter, setStatutFilter] = useState<Statut5Pourquoi | 'tous'>('tous');
  const [parcFilter, setParcFilter] = useState('');
  const [recherche, setRecherche] = useState('');
  const [modaleOuverte, setModaleOuverte] = useState(false);

  const filtrees = useMemo(() => {
    let result = fiches ?? [];
    if (statutFilter !== 'tous') result = result.filter((f) => f.statut === statutFilter);
    if (parcFilter) result = result.filter((f) => f.parc_id === parcFilter);
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter((f) => {
        const haystack = [f.titre, f.equipements?.code, f.equipements?.libelle]
          .filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }
    return result;
  }, [fiches, statutFilter, parcFilter, recherche]);

  const compteurs = useMemo(() => {
    const all = fiches ?? [];
    const parParc = new Map<string, { nom: string; nb: number }>();
    for (const f of all) {
      const pNom = f.parcs?.nom ?? 'Inconnu';
      const existing = parParc.get(f.parc_id);
      if (existing) existing.nb++;
      else parParc.set(f.parc_id, { nom: pNom, nb: 1 });
    }
    return {
      total: all.length,
      ouvert: all.filter((f) => f.statut === 'ouvert').length,
      enCours: all.filter((f) => f.statut === 'en_cours').length,
      cloture: all.filter((f) => f.statut === 'cloture').length,
      parParc: Array.from(parParc.values()),
    };
  }, [fiches]);

  const handleCreated = (id: string) => {
    setModaleOuverte(false);
    navigate(`/gmao/cinq-pourquoi/${id}`);
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">5 Pourquoi</h1>
          <p className="text-[13px] text-dim mt-1">
            Analyses de cause racine &mdash; methode Lean
          </p>
        </div>
        <button
          onClick={() => setModaleOuverte(true)}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center"
        >
          <span className="text-base leading-none">+</span> Nouvelle fiche 5P
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <Compteur label="Total" value={compteurs.total} />
        <Compteur label="Ouvert" value={compteurs.ouvert} color="red" />
        <Compteur label="En cours" value={compteurs.enCours} color="amber" />
        <Compteur label="Cloture" value={compteurs.cloture} color="green" />
        {compteurs.parParc.map((p) => (
          <Compteur key={p.nom} label={p.nom} value={p.nb} />
        ))}
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (titre, equipement)..."
            className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
          <select
            value={parcFilter}
            onChange={(e) => setParcFilter(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[200px]"
          >
            <option value="">Tous les parcs</option>
            {parcs?.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-px">
          {STATUTS_FILTRE.map((s) => (
            <Pill
              key={s.value}
              active={statutFilter === s.value}
              variant="cyan"
              onClick={() => setStatutFilter(s.value)}
              className="min-h-[36px]"
            >
              {s.label}
            </Pill>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-[140px] animate-pulse" />
          ))}
        </div>
      ) : filtrees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm mb-1">Aucune fiche 5 Pourquoi.</p>
          <p className="text-faint text-xs mb-5">Ajustez vos filtres ou creez une nouvelle fiche.</p>
          <button
            onClick={() => setModaleOuverte(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
          >
            + Nouvelle fiche 5P
          </button>
        </div>
      ) : (
        <>
          {filtrees.length !== (fiches ?? []).length && (
            <p className="text-[12px] text-dim mb-3">
              {filtrees.length} fiche{filtrees.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtrees.map((f) => (
              <FicheCard key={f.id} fiche={f} onClick={() => navigate(`/gmao/cinq-pourquoi/${f.id}`)} />
            ))}
          </div>
        </>
      )}

      {modaleOuverte && (
        <ModaleCreerFiche5P onClose={() => setModaleOuverte(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}

function FicheCard({ fiche: f, onClick }: { fiche: Fiche5PourquoiAvecJoins; onClick: () => void }) {
  const badge = STATUT_BADGE[f.statut];
  const nb = countPourquoi(f);
  const dateStr = new Date(f.cree_le).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <Card
      className="cursor-pointer hover:border-white/10 transition-colors border border-transparent p-4 px-[18px]"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap', badge.cls)}>
          {badge.label}
        </span>
        <span className="text-[10px] text-faint whitespace-nowrap">{dateStr}</span>
      </div>

      <h3 className="text-[13px] font-medium leading-snug mb-1.5 line-clamp-2">{f.titre}</h3>

      {f.equipements && (
        <p className="text-[11px] text-dim mb-1.5 truncate">
          <span className="text-nikito-cyan font-mono mr-1">{f.equipements.code}</span>
          {f.equipements.libelle}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-dim">{f.parcs?.nom}</span>
        <ProgressionDots count={nb} />
      </div>
    </Card>
  );
}

function ProgressionDots({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={cn('w-2 h-2 rounded-full', n <= count ? 'bg-nikito-cyan' : 'bg-white/[0.08]')}
        />
      ))}
      <span className="text-[10px] text-dim ml-1">{count}/5</span>
    </div>
  );
}

function Compteur({ label, value, color }: { label: string; value: number; color?: 'red' | 'amber' | 'green' }) {
  const textCls = color === 'red' ? 'text-red' : color === 'amber' ? 'text-amber' : color === 'green' ? 'text-green' : 'text-text';
  return (
    <div className="bg-bg-card rounded-xl px-4 py-2.5 border border-white/[0.06] min-w-[100px]">
      <div className="text-[10px] text-dim uppercase tracking-wider">{label}</div>
      <div className={cn('text-lg font-semibold', textCls)}>{value}</div>
    </div>
  );
}
