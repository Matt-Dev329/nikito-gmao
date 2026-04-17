import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFiche5P, useModifierFiche5P } from '@/hooks/queries/useFiches5P';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Statut5Pourquoi } from '@/types/database';

const POURQUOI_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

const STATUT_BADGE: Record<Statut5Pourquoi, { label: string; cls: string }> = {
  ouvert: { label: 'Ouvert', cls: 'bg-red/15 text-red' },
  valide: { label: 'Valide', cls: 'bg-nikito-cyan/15 text-nikito-cyan' },
  audit_en_cours: { label: 'Audit 90j', cls: 'bg-amber/15 text-amber' },
  clos: { label: 'Clos', cls: 'bg-green/15 text-green' },
};

const TRANSITIONS: Record<Statut5Pourquoi, { next: Statut5Pourquoi; label: string } | null> = {
  ouvert: { next: 'valide', label: 'Valider le 5P' },
  valide: { next: 'audit_en_cours', label: 'Programmer audit 90j' },
  audit_en_cours: { next: 'clos', label: 'Cloturer (audit OK)' },
  clos: null,
};

export function FicheCinqPourquoi() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { data: fiche, isLoading } = useFiche5P(id);
  const modifier = useModifierFiche5P();

  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [q4, setQ4] = useState('');
  const [q5, setQ5] = useState('');
  const [causeRacine, setCauseRacine] = useState('');
  const [contreMesure, setContreMesure] = useState('');
  const [dirty, setDirty] = useState(false);

  const pSetters = [setQ1, setQ2, setQ3, setQ4, setQ5];
  const pValues = [q1, q2, q3, q4, q5];

  useEffect(() => {
    if (!fiche) return;
    setQ1(fiche.q1 ?? '');
    setQ2(fiche.q2 ?? '');
    setQ3(fiche.q3 ?? '');
    setQ4(fiche.q4 ?? '');
    setQ5(fiche.q5 ?? '');
    setCauseRacine(fiche.cause_racine ?? '');
    setContreMesure(fiche.contre_mesure ?? '');
    setDirty(false);
  }, [fiche]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 md:px-7">
        <div className="animate-pulse space-y-4">
          <div className="bg-bg-card rounded-xl h-20" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!fiche) {
    return (
      <div className="p-4 md:p-6 md:px-7 text-center py-16">
        <p className="text-dim text-sm mb-3">Fiche introuvable.</p>
        <button onClick={() => navigate('/gmao/cinq-pourquoi')} className="text-nikito-cyan text-sm">
          Retour a la liste
        </button>
      </div>
    );
  }

  const verrouille = fiche.statut === 'clos';
  const badge = STATUT_BADGE[fiche.statut];
  const transition = TRANSITIONS[fiche.statut];
  const nbPourquoi = POURQUOI_KEYS.filter((k) => fiche[k] && fiche[k]!.trim().length > 0).length;
  const dateStr = new Date(fiche.ouvert_le).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const sauver = async () => {
    await modifier.mutateAsync({
      id: fiche.id,
      q1: q1 || null,
      q2: q2 || null,
      q3: q3 || null,
      q4: q4 || null,
      q5: q5 || null,
      cause_racine: causeRacine || null,
      contre_mesure: contreMesure || null,
    });
    setDirty(false);
  };

  const changerStatut = async (statut: Statut5Pourquoi) => {
    if (dirty) await sauver();
    const extra: Record<string, unknown> = { id: fiche.id, statut };
    if (statut === 'valide') {
      extra.validee_par_id = utilisateur?.id ?? null;
      extra.validee_le = new Date().toISOString();
    }
    if (statut === 'audit_en_cours') {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      extra.audit_90j_le = d.toISOString().slice(0, 10);
    }
    await modifier.mutateAsync(extra as Parameters<typeof modifier.mutateAsync>[0]);
  };

  const handlePChange = (index: number, value: string) => {
    pSetters[index](value);
    setDirty(true);
  };

  return (
    <div className="p-4 md:p-6 md:px-7 max-w-[820px]">
      <div className="flex items-center gap-2 text-[12px] text-dim mb-4">
        <button onClick={() => navigate('/gmao/cinq-pourquoi')} className="text-nikito-cyan hover:underline">
          5 Pourquoi
        </button>
        <span className="text-faint">/</span>
        <span className="truncate max-w-[200px]">{fiche.incidents?.numero_bt ?? 'Fiche'}</span>
      </div>

      <Card className="mb-5 p-4 px-[18px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', badge.cls)}>
                {badge.label}
              </span>
              <ProgressionDots count={nbPourquoi} />
            </div>
            {fiche.incidents && (
              <h1 className="text-[17px] font-semibold leading-snug mb-1">
                <span className="text-nikito-pink font-mono mr-2">{fiche.incidents.numero_bt}</span>
                {fiche.incidents.titre}
              </h1>
            )}
            <div className="flex items-center gap-2 flex-wrap text-[12px] text-dim">
              {fiche.equipements && (
                <>
                  <span className="text-nikito-cyan font-mono">{fiche.equipements.code}</span>
                  <span>{fiche.equipements.libelle}</span>
                  <span className="text-faint">|</span>
                </>
              )}
              <span>{fiche.equipements?.parcs?.nom}</span>
              <span className="text-faint">|</span>
              <span>{dateStr}</span>
            </div>
            {fiche.audit_90j_le && (
              <p className="text-[11px] text-amber mt-1.5">
                Audit 90j prevu le {new Date(fiche.audit_90j_le).toLocaleDateString('fr-FR')}
                {fiche.audit_resultat && ` — Resultat : ${fiche.audit_resultat}`}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {transition && !verrouille && (
              <button
                onClick={() => changerStatut(transition.next)}
                disabled={modifier.isPending}
                className={cn(
                  'px-4 py-2 rounded-[10px] text-[12px] font-bold min-h-[44px] whitespace-nowrap',
                  transition.next === 'clos'
                    ? 'bg-green/15 text-green border border-green/30 hover:bg-green/25'
                    : 'bg-gradient-cta text-text'
                )}
              >
                {transition.label}
              </button>
            )}
          </div>
        </div>
      </Card>

      {verrouille && (
        <div className="bg-green/5 border border-green/20 rounded-[10px] p-3 mb-4 text-[12px] text-green flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green flex-shrink-0" />
          Fiche close &mdash; les champs ne sont plus modifiables.
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-[11px] text-dim uppercase tracking-[1.2px] mb-3">Les 5 Pourquoi</h2>
        <div className="space-y-3">
          {POURQUOI_KEYS.map((_, i) => (
            <PourquoiBlock
              key={i}
              numero={i + 1}
              value={pValues[i]}
              onChange={(v) => handlePChange(i, v)}
              disabled={verrouille}
            />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-[11px] text-dim uppercase tracking-[1.2px] mb-3">Cause racine</h2>
        <div className="border-l-[3px] border-l-nikito-pink rounded-xl bg-bg-card p-4 px-[18px]">
          {verrouille ? (
            <p className="text-[13px] text-text whitespace-pre-wrap min-h-[40px]">
              {causeRacine || <span className="text-faint italic">Non renseignee</span>}
            </p>
          ) : (
            <textarea
              value={causeRacine}
              onChange={(e) => { setCauseRacine(e.target.value); setDirty(true); }}
              placeholder="Quelle est la cause racine identifiee ?"
              rows={3}
              className="w-full bg-transparent text-text text-[13px] resize-y outline-none placeholder:text-faint min-h-[70px]"
            />
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-[11px] text-dim uppercase tracking-[1.2px] mb-3">Contre-mesure</h2>
        <Card className="p-4 px-[18px]">
          {verrouille ? (
            <p className="text-[13px] text-text whitespace-pre-wrap min-h-[40px]">
              {contreMesure || <span className="text-faint italic">Non renseignee</span>}
            </p>
          ) : (
            <textarea
              value={contreMesure}
              onChange={(e) => { setContreMesure(e.target.value); setDirty(true); }}
              placeholder="Quelle contre-mesure est mise en place ?"
              rows={3}
              className="w-full bg-transparent text-text text-[13px] resize-y outline-none placeholder:text-faint min-h-[70px]"
            />
          )}
        </Card>
      </section>

      {modifier.isError && (
        <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
          Erreur : {(modifier.error as Error).message}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-between items-stretch sm:items-center pb-6">
        <button
          onClick={() => navigate('/gmao/cinq-pourquoi')}
          className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
        >
          Retour a la liste
        </button>
        {!verrouille && (
          <button
            onClick={sauver}
            disabled={!dirty || modifier.isPending}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!dirty || modifier.isPending) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {modifier.isPending ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        )}
      </div>
    </div>
  );
}

function PourquoiBlock({
  numero, value, onChange, disabled,
}: {
  numero: number;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-10 h-10 rounded-[10px] bg-nikito-cyan/10 flex items-center justify-center">
        <span className="text-nikito-cyan font-bold text-[14px]">P{numero}</span>
      </div>
      <div className="flex-1 bg-bg-card rounded-xl p-3.5 px-4 border border-white/[0.04]">
        <div className="text-[10px] text-dim uppercase tracking-wider mb-1.5">Pourquoi {numero}</div>
        {disabled ? (
          <p className="text-[13px] text-text whitespace-pre-wrap min-h-[32px]">
            {value || <span className="text-faint italic">Non renseigne</span>}
          </p>
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Pourquoi ${numero}...`}
            rows={2}
            className="w-full bg-transparent text-text text-[13px] resize-y outline-none placeholder:text-faint min-h-[48px]"
          />
        )}
      </div>
    </div>
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
