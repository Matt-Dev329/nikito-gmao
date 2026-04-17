import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useFiche5P,
  useModifierFiche5P,
  useStandardsEvolutifs,
  useCreerStandard,
  useModifierStandard,
} from '@/hooks/queries/useFiches5P';
import { useUtilisateursActifs } from '@/hooks/queries/useUtilisateurs';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Statut5Pourquoi, StandardEvolutifAvecJoins, StatutStandardEvolutif } from '@/types/database';

const POURQUOI_KEYS = ['pourquoi_1', 'pourquoi_2', 'pourquoi_3', 'pourquoi_4', 'pourquoi_5'] as const;

const STATUT_BADGE: Record<Statut5Pourquoi, { label: string; cls: string }> = {
  ouvert: { label: 'Ouvert', cls: 'bg-red/15 text-red' },
  en_cours: { label: 'En cours', cls: 'bg-amber/15 text-amber' },
  cloture: { label: 'Cloture', cls: 'bg-green/15 text-green' },
};

const TRANSITIONS: Record<Statut5Pourquoi, { next: Statut5Pourquoi; label: string } | null> = {
  ouvert: { next: 'en_cours', label: 'Passer en cours' },
  en_cours: { next: 'cloture', label: 'Cloturer la fiche' },
  cloture: null,
};

const STATUT_ACTION: Record<StatutStandardEvolutif, { label: string; cls: string }> = {
  a_faire: { label: 'A faire', cls: 'bg-red/15 text-red' },
  en_cours: { label: 'En cours', cls: 'bg-amber/15 text-amber' },
  fait: { label: 'Fait', cls: 'bg-green/15 text-green' },
};

export function FicheCinqPourquoi() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { data: fiche, isLoading } = useFiche5P(id);
  const modifier = useModifierFiche5P();
  const { data: standards, isLoading: stdLoading } = useStandardsEvolutifs(id);

  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [p4, setP4] = useState('');
  const [p5, setP5] = useState('');
  const [causeRacine, setCauseRacine] = useState('');
  const [dirty, setDirty] = useState(false);
  const [ajoutAction, setAjoutAction] = useState(false);

  const pSetters = [setP1, setP2, setP3, setP4, setP5];
  const pValues = [p1, p2, p3, p4, p5];

  useEffect(() => {
    if (!fiche) return;
    setP1(fiche.pourquoi_1 ?? '');
    setP2(fiche.pourquoi_2 ?? '');
    setP3(fiche.pourquoi_3 ?? '');
    setP4(fiche.pourquoi_4 ?? '');
    setP5(fiche.pourquoi_5 ?? '');
    setCauseRacine(fiche.cause_racine ?? '');
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

  const verrouille = fiche.statut === 'cloture';
  const badge = STATUT_BADGE[fiche.statut];
  const transition = TRANSITIONS[fiche.statut];
  const nbPourquoi = POURQUOI_KEYS.filter((k) => fiche[k] && fiche[k]!.trim().length > 0).length;
  const dateStr = new Date(fiche.cree_le).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const sauver = async () => {
    await modifier.mutateAsync({
      id: fiche.id,
      pourquoi_1: p1 || null,
      pourquoi_2: p2 || null,
      pourquoi_3: p3 || null,
      pourquoi_4: p4 || null,
      pourquoi_5: p5 || null,
      cause_racine: causeRacine || null,
    });
    setDirty(false);
  };

  const changerStatut = async (statut: Statut5Pourquoi) => {
    if (dirty) await sauver();
    const extra: Record<string, unknown> = { id: fiche.id, statut };
    if (statut === 'cloture') {
      extra.cloture_le = new Date().toISOString();
      extra.cloture_par_id = utilisateur?.id ?? null;
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
        <span className="truncate max-w-[200px]">{fiche.titre}</span>
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
            <h1 className="text-[17px] font-semibold leading-snug mb-1">{fiche.titre}</h1>
            <div className="flex items-center gap-2 flex-wrap text-[12px] text-dim">
              {fiche.equipements && (
                <>
                  <span className="text-nikito-cyan font-mono">{fiche.equipements.code}</span>
                  <span>{fiche.equipements.libelle}</span>
                  <span className="text-faint">|</span>
                </>
              )}
              <span>{fiche.parcs?.nom}</span>
              <span className="text-faint">|</span>
              <span>{dateStr}</span>
            </div>
            {fiche.description && (
              <p className="text-[12px] text-dim mt-2 bg-bg-deep rounded-lg p-2.5 border border-white/[0.04]">
                {fiche.description}
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
                  transition.next === 'cloture'
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
          Fiche cloturee &mdash; les champs ne sont plus modifiables.
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] text-dim uppercase tracking-[1.2px]">Actions correctives</h2>
          {!verrouille && (
            <button
              onClick={() => setAjoutAction(true)}
              className="text-nikito-cyan text-[12px] font-medium hover:underline min-h-[44px] flex items-center"
            >
              + Ajouter une action
            </button>
          )}
        </div>

        {stdLoading ? (
          <div className="bg-bg-card rounded-xl h-20 animate-pulse" />
        ) : (standards ?? []).length === 0 && !ajoutAction ? (
          <Card className="p-4 text-center">
            <p className="text-[12px] text-faint">Aucune action corrective.</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {(standards ?? []).map((s) => (
              <ActionCard key={s.id} action={s} verrouille={verrouille} />
            ))}
          </div>
        )}

        {ajoutAction && id && (
          <FormulaireAction
            ficheId={id}
            onClose={() => setAjoutAction(false)}
          />
        )}
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

function ActionCard({ action: a, verrouille }: { action: StandardEvolutifAvecJoins; verrouille: boolean }) {
  const modifierStd = useModifierStandard();
  const statut = STATUT_ACTION[a.statut];
  const responsable = a.utilisateurs ? `${a.utilisateurs.prenom} ${a.utilisateurs.nom}` : null;
  const deadline = a.deadline ? new Date(a.deadline).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

  const cycleStatut = async () => {
    if (verrouille) return;
    const next: StatutStandardEvolutif = a.statut === 'a_faire' ? 'en_cours' : a.statut === 'en_cours' ? 'fait' : 'a_faire';
    await modifierStd.mutateAsync({ id: a.id, fiche_5p_id: a.fiche_5p_id, statut: next });
  };

  return (
    <Card className="p-3.5 px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-text leading-snug">{a.description}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-dim">
            {responsable && <span>{responsable}</span>}
            {deadline && (
              <span className={cn(
                a.deadline && new Date(a.deadline) < new Date() && a.statut !== 'fait' ? 'text-red' : ''
              )}>
                {deadline}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={cycleStatut}
          disabled={verrouille || modifierStd.isPending}
          className={cn(
            'text-[10px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap min-h-[28px]',
            statut.cls,
            !verrouille && 'cursor-pointer hover:opacity-80',
            verrouille && 'cursor-default'
          )}
        >
          {statut.label}
        </button>
      </div>
    </Card>
  );
}

function FormulaireAction({ ficheId, onClose }: { ficheId: string; onClose: () => void }) {
  const creerStd = useCreerStandard();
  const { data: utilisateurs } = useUtilisateursActifs();
  const [desc, setDesc] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [deadline, setDeadline] = useState('');

  const submit = async () => {
    if (!desc.trim()) return;
    await creerStd.mutateAsync({
      fiche_5p_id: ficheId,
      description: desc.trim(),
      responsable_id: responsableId || null,
      deadline: deadline || null,
    });
    onClose();
  };

  return (
    <Card className="mt-2.5 p-4 px-[18px] border border-nikito-cyan/20">
      <div className="text-[11px] text-dim uppercase tracking-wider mb-3">Nouvelle action corrective</div>
      <div className="space-y-3 mb-4">
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description de l'action..."
          rows={2}
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[60px]"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <select
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
          >
            <option value="">Responsable (optionnel)</option>
            {(utilisateurs ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </select>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
          />
        </div>
      </div>

      {creerStd.isError && (
        <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
          Erreur : {(creerStd.error as Error).message}
        </div>
      )}

      <div className="flex gap-2.5 justify-end">
        <button onClick={onClose} className="text-dim text-[12px] px-3 py-2 min-h-[44px]">
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={!desc.trim() || creerStd.isPending}
          className={cn(
            'bg-gradient-cta text-text px-5 py-2 rounded-[10px] text-[12px] font-bold min-h-[44px]',
            (!desc.trim() || creerStd.isPending) && 'opacity-40 cursor-not-allowed'
          )}
        >
          {creerStd.isPending ? 'Ajout...' : 'Ajouter'}
        </button>
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
