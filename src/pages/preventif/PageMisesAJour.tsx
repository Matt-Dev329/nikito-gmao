import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { aujourdhuiParis } from '@/lib/dates';
import { useToast } from '@/components/ui/ToastProvider';
import { FiltreParcPills } from '@/components/ui/FiltreParcPills';
import { useFiltreParc } from '@/hooks/useParcCourant';

interface Plan {
  id: string;
  parc_id: string;
  activite: string;
  libelle: string;
  periode_mois: number;
  prochaine_echeance: string;
  derniere_execution: string | null;
  parcs: { code: string; nom: string } | null;
}

interface LigneRegistre {
  id: string;
  plan_id: string;
  fait_le: string;
  version: string | null;
  notes: string | null;
  realise_par_nom: string | null;
  cree_le: string;
  parcs: { code: string; nom: string } | null;
  mises_a_jour_plans: { libelle: string } | null;
}

const dateFr = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function etat(p: Plan): { label: string; cls: string; bord: string } {
  const auj = aujourdhuiParis();
  const jours = Math.round((new Date(`${p.prochaine_echeance}T12:00:00`).getTime() - new Date(`${auj}T12:00:00`).getTime()) / 86400000);
  if (jours < 0) return { label: `En retard de ${-jours} j`, cls: 'bg-red/15 text-red', bord: 'border-red/40' };
  if (jours <= 30) return { label: `À faire · ${jours} j`, cls: 'bg-amber/15 text-amber', bord: 'border-amber/40' };
  return { label: 'À jour', cls: 'bg-green/15 text-green', bord: 'border-white/[0.06]' };
}

function usePlans() {
  return useQuery({
    queryKey: ['mises_a_jour_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mises_a_jour_plans')
        .select('id, parc_id, activite, libelle, periode_mois, prochaine_echeance, derniere_execution, parcs(code, nom)')
        .eq('actif', true)
        .order('prochaine_echeance');
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });
}

function useRegistre() {
  return useQuery({
    queryKey: ['mises_a_jour_registre'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mises_a_jour_registre')
        .select('id, plan_id, fait_le, version, notes, realise_par_nom, cree_le, parcs(code, nom), mises_a_jour_plans(libelle)')
        .order('fait_le', { ascending: false })
        .order('cree_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LigneRegistre[];
    },
  });
}

/** Mises à jour périodiques (Laser Game 3 fois par an…) : échéances et registre de toutes les mises à jour. */
export function PageMisesAJour() {
  const { data: plans, isLoading } = usePlans();
  const { data: registre } = useRegistre();
  const [parc, setParc] = useFiltreParc<string | null>(null, 'code');
  const [saisie, setSaisie] = useState<Plan | null>(null);

  const plansFiltres = useMemo(() => (plans ?? []).filter((p) => !parc || p.parcs?.code === parc), [plans, parc]);
  const registreFiltre = useMemo(() => (registre ?? []).filter((r) => !parc || r.parcs?.code === parc), [registre, parc]);
  const comptes = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of plans ?? []) if (p.parcs?.code) m.set(p.parcs.code, (m.get(p.parcs.code) ?? 0) + 1);
    return [...m.entries()].sort();
  }, [plans]);

  return (
    <div className="p-4 md:p-6 md:px-7 flex flex-col gap-4">
      <div>
        <h1 className="text-xl md:text-[22px] font-semibold m-0">MAJ Laser Game</h1>
        <p className="text-[13px] text-dim mt-1">
          Mises à jour périodiques des activités (Laser Game : 3 fois par an, tous les 4 mois). Rappel automatique au chef
          d’équipe, aux directeurs et aux managers principaux du parc.
        </p>
      </div>

      <FiltreParcPills parcs={comptes} actif={parc} total={plans?.length} onChange={setParc} />

      {isLoading ? (
        <div className="bg-bg-card rounded-xl h-24 animate-pulse" />
      ) : plansFiltres.length === 0 ? (
        <div className="text-dim text-sm">Aucune mise à jour planifiée{parc ? ` pour ${parc}` : ''}.</div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {plansFiltres.map((p) => {
            const e = etat(p);
            return (
              <div key={p.id} className={cn('bg-bg-card rounded-xl p-4 border flex flex-col gap-2', e.bord)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-md', e.cls)}>{e.label}</span>
                  <span className="text-[11px] text-dim">Tous les {p.periode_mois} mois</span>
                </div>
                <div className="text-[15px] font-semibold">
                  {p.libelle} <span className="text-dim font-normal">· {p.parcs?.nom ?? p.parcs?.code}</span>
                </div>
                <div className="text-[12px] text-dim">
                  Échéance : <strong className="text-text">{dateFr(p.prochaine_echeance)}</strong>
                  {p.derniere_execution && <> · Dernière : {dateFr(p.derniere_execution)}</>}
                </div>
                <button
                  onClick={() => setSaisie(p)}
                  className="mt-1 self-start px-4 min-h-[44px] rounded-[10px] text-[13px] font-bold bg-green/15 text-green border border-green/30"
                >
                  ✓ Mise à jour faite
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="text-[16px] font-semibold mb-2">Registre des mises à jour</h2>
        {registreFiltre.length === 0 ? (
          <div className="text-dim text-sm bg-bg-card rounded-xl p-4 border border-white/[0.06]">
            Aucune mise à jour enregistrée pour l’instant.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {registreFiltre.map((r) => (
              <div key={r.id} className="bg-bg-card rounded-xl px-4 py-3 border border-white/[0.06] text-[13px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong>{dateFr(r.fait_le)}</strong>
                  <span className="text-nikito-cyan font-semibold">{r.parcs?.code}</span>
                  <span>{r.mises_a_jour_plans?.libelle}</span>
                  {r.version && <span className="text-[12px] bg-bg-deep px-2 py-0.5 rounded">Version {r.version}</span>}
                  <span className="text-dim text-[12px] ml-auto">par {r.realise_par_nom ?? '—'}</span>
                </div>
                {r.notes && <div className="text-dim mt-1 whitespace-pre-wrap">{r.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {saisie && <ModaleMiseAJourFaite plan={saisie} onClose={() => setSaisie(null)} />}
    </div>
  );
}

function ModaleMiseAJourFaite({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(aujourdhuiParis());
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');

  const enregistrer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('enregistrer_mise_a_jour', {
        p_plan_id: plan.id,
        p_fait_le: date,
        p_version: version,
        p_notes: notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mises_a_jour_plans'] });
      qc.invalidateQueries({ queryKey: ['mises_a_jour_registre'] });
      toast.success(`${plan.libelle} · ${plan.parcs?.code ?? ''} enregistrée dans le registre`);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[460px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-green/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-[16px] font-bold">✓ {plan.libelle}</div>
          <div className="text-[12px] text-dim">{plan.parcs?.nom}</div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-dim">Date de la mise à jour</span>
          <input
            type="date"
            value={date}
            max={aujourdhuiParis()}
            onChange={(e) => setDate(e.target.value)}
            className="bg-bg-app border border-white/10 rounded-lg px-3 min-h-[44px] text-[14px]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-dim">Version installée (facultatif)</span>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Ex. : 4.2.1"
            className="bg-bg-app border border-white/10 rounded-lg px-3 min-h-[44px] text-[14px]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-dim">Remarques (facultatif)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ex. : mise à jour des packs et du serveur, 2 packs à revoir"
            className="bg-bg-app border border-white/10 rounded-lg px-3 py-2 text-[14px]"
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 min-h-[44px] rounded-[10px] text-[13px] text-dim">
            Annuler
          </button>
          <button
            onClick={() => enregistrer.mutate()}
            disabled={!date || enregistrer.isPending}
            className="px-4 min-h-[44px] rounded-[10px] text-[13px] font-bold bg-gradient-cta text-text disabled:opacity-50"
          >
            {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
