import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import { voitTableauDeBord } from '@/lib/acces';

type Statut = 'idee' | 'en_cours' | 'termine' | 'abandonne';
type Faisabilite = 'realisable' | 'sous_conditions' | 'difficile' | 'non_realisable';

interface Avis {
  verdict: string;
  interet: number;
  faisabilite: Faisabilite;
  resume: string;
  points_forts: string[];
  risques: string[];
  etapes: { titre: string; detail: string | null }[];
  budget_estime: string | null;
  delai_estime: string | null;
  ressources: string[];
  questions: string[];
  ameliorations: string[];
  reponse_question: string | null;
  question?: string | null;
}

interface Projet {
  id: string;
  titre: string;
  description: string | null;
  notes: string | null;
  statut: Statut;
  origine: 'moi' | 'alba';
  avis: Avis | null;
  avis_statut: 'en_cours' | 'terminee' | 'echec' | null;
  avis_erreur: string | null;
  avis_le: string | null;
  cree_le: string;
  modifie_le: string;
}

const STATUTS: Record<Statut, { label: string; classe: string }> = {
  idee: { label: 'Idée', classe: 'bg-nikito-violet/15 text-nikito-violet' },
  en_cours: { label: 'En cours', classe: 'bg-nikito-cyan/15 text-nikito-cyan' },
  termine: { label: 'Terminé', classe: 'bg-green/15 text-green' },
  abandonne: { label: 'Abandonné', classe: 'bg-white/[0.06] text-dim' },
};

const FAISABILITE: Record<Faisabilite, { label: string; classe: string }> = {
  realisable: { label: 'Réalisable', classe: 'bg-green/15 text-green' },
  sous_conditions: { label: 'Réalisable sous conditions', classe: 'bg-amber/15 text-amber' },
  difficile: { label: 'Difficile', classe: 'bg-red/15 text-red' },
  non_realisable: { label: 'Pas réalisable', classe: 'bg-red/15 text-red' },
};

type Filtre = 'actifs' | Statut | 'tous';
const FILTRES: [Filtre, string][] = [
  ['actifs', 'Idées et en cours'],
  ['idee', 'Idées'],
  ['en_cours', 'En cours'],
  ['termine', 'Terminés'],
  ['abandonne', 'Abandonnés'],
  ['tous', 'Tous'],
];
const correspond = (p: Projet, f: Filtre) =>
  f === 'tous' || (f === 'actifs' ? p.statut === 'idee' || p.statut === 'en_cours' : p.statut === f);

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';
const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR');

function useProjets() {
  return useQuery({
    queryKey: ['projets-perso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projets_perso')
        .select('id, titre, description, notes, statut, origine, avis, avis_statut, avis_erreur, avis_le, cree_le, modifie_le')
        .eq('actif', true)
        .order('modifie_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Projet[];
    },
    // Un avis en préparation (même lancé depuis un autre écran) : on suit son arrivée
    refetchInterval: (q) => ((q.state.data ?? []).some((p) => p.avis_statut === 'en_cours') ? 5000 : false),
  });
}

/** Demande l'avis d'ALBA sur un projet (1 à 2 minutes) */
function useDemanderAvis() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async ({ projetId, question }: { projetId: string; question?: string }) => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['projets-perso'] }), 1500);
      const { data, error } = await supabase.functions.invoke('avis-projet', { body: { projet_id: projetId, question } });
      if (error || data?.success === false) throw new Error(data?.error ?? error?.message ?? 'Avis impossible');
    },
    onSuccess: () => toast.success('Avis d’ALBA reçu'),
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['projets-perso'] }),
  });
}

/** Projets personnels avec l'avis d'ALBA — réservé à Ryad. */
export function PageProjets() {
  const { utilisateur } = useAuth();
  if (utilisateur && !voitTableauDeBord(utilisateur)) return <Navigate to="/gmao/operations" replace />;
  return <ContenuProjets />;
}

function ContenuProjets() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: projets, isLoading, isError, error } = useProjets();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>('actifs');

  const idees = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('avis-projet', { body: { mode: 'idees' } });
      if (error || data?.success === false) throw new Error(data?.error ?? error?.message ?? 'Propositions impossibles');
      return (data?.nombre as number) ?? 0;
    },
    onSuccess: (n) => {
      toast.success(n ? `${n} projets proposés par ALBA` : 'Aucune proposition cette fois');
      setFiltre('actifs');
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['projets-perso'] }),
  });

  const visibles = useMemo(() => (projets ?? []).filter((p) => correspond(p, filtre)), [projets, filtre]);
  const compte = (f: Filtre) => (projets ?? []).filter((p) => correspond(p, f)).length;

  const projet = ouvert ? (projets ?? []).find((p) => p.id === ouvert) : null;
  if (projet) return <DetailProjet projet={projet} onFermer={() => setOuvert(null)} />;

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Projets</h1>
          <p className="text-[13px] text-dim mt-1">
            Tes idées et projets, avec l’avis d’ALBA : est-ce une bonne idée, est-ce réalisable, comment s’y prendre — visibles par toi seul
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => idees.mutate()}
            disabled={idees.isPending}
            className={cn(
              'border border-nikito-violet/50 text-nikito-violet bg-nikito-violet/10 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]',
              idees.isPending && 'opacity-60 animate-pulse'
            )}
          >
            {idees.isPending ? 'ALBA réfléchit… (1 à 2 min)' : '💡 Propose-moi des projets'}
          </button>
          {!ajout && (
            <button
              onClick={() => setAjout(true)}
              className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
            >
              + Nouveau projet
            </button>
          )}
        </div>
      </div>

      {ajout && <FormulaireProjet onFini={(id) => (setAjout(false), id && setOuvert(id))} />}

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
        {FILTRES.map(([f, label]) => (
          <Pill key={f} variant="cyan" active={filtre === f} onClick={() => setFiltre(f)}>
            {label} <span className="opacity-60">· {compte(f)}</span>
          </Pill>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">
          Aucun projet ici. Ajoute le tien ou demande à ALBA de t’en proposer.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibles.map((p) => (
            <CarteProjet key={p.id} projet={p} onOuvrir={() => setOuvert(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Interet({ valeur }: { valeur: number }) {
  return (
    <span className="text-[12px] text-amber tracking-wider" aria-label={`Intérêt ${valeur} sur 5`}>
      {'★'.repeat(valeur)}
      <span className="text-faint">{'★'.repeat(Math.max(0, 5 - valeur))}</span>
    </span>
  );
}

function CarteProjet({ projet: p, onOuvrir }: { projet: Projet; onOuvrir: () => void }) {
  return (
    <button
      onClick={onOuvrir}
      className="text-left bg-bg-card rounded-xl border border-white/[0.06] hover:border-nikito-cyan/40 p-4 flex flex-col gap-2 transition-colors"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('text-[11px] px-2 py-0.5 rounded font-semibold', STATUTS[p.statut].classe)}>{STATUTS[p.statut].label}</span>
        {p.origine === 'alba' && <span className="text-[11px] px-2 py-0.5 rounded bg-nikito-violet/15 text-nikito-violet">Proposé par ALBA</span>}
        {p.avis && <span className={cn('text-[11px] px-2 py-0.5 rounded', FAISABILITE[p.avis.faisabilite].classe)}>{FAISABILITE[p.avis.faisabilite].label}</span>}
        {p.avis && <Interet valeur={p.avis.interet} />}
      </div>
      <div className="text-[15px] font-semibold leading-tight">{p.titre}</div>
      {p.avis_statut === 'en_cours' ? (
        <div className="text-[12px] text-nikito-cyan animate-pulse">ALBA prépare son avis…</div>
      ) : p.avis ? (
        <div className="text-[13px] text-text/90">« {p.avis.verdict} »</div>
      ) : p.description ? (
        <div className="text-[13px] text-dim line-clamp-2">{p.description}</div>
      ) : null}
      <div className="text-[11px] text-faint mt-auto">Mis à jour le {dateFr(p.modifie_le)}</div>
    </button>
  );
}

function FormulaireProjet({ onFini }: { onFini: (id?: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const avis = useDemanderAvis();
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [demanderAvis, setDemanderAvis] = useState(true);

  const creer = useMutation({
    mutationFn: async () => {
      if (!titre.trim()) throw new Error('Donne un titre au projet');
      const { data, error } = await supabase
        .from('projets_perso')
        .insert({ titre: titre.trim(), description: description.trim() || null })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success('Projet ajouté');
      qc.invalidateQueries({ queryKey: ['projets-perso'] });
      if (demanderAvis) avis.mutate({ projetId: id });
      onFini(id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="bg-bg-card rounded-xl border border-nikito-cyan/30 p-4 mb-4 grid gap-2.5 max-w-[640px]">
      <div className="text-[14px] font-semibold">Nouveau projet</div>
      <input
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        maxLength={160}
        placeholder="Titre (ex. Atelier de réparation des arcades à SGB)"
        className={champ}
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={5}
        maxLength={6000}
        placeholder="Explique ton idée : ce que tu veux faire, pourquoi, avec quoi, pour quand…"
        className={cn(champ, 'resize-y')}
      />
      <label className="flex items-center gap-2 min-h-[44px] text-[13px] cursor-pointer">
        <input type="checkbox" checked={demanderAvis} onChange={(e) => setDemanderAvis(e.target.checked)} className="w-5 h-5 accent-nikito-cyan" />
        Demander l’avis d’ALBA tout de suite
      </label>
      <div className="flex gap-2 justify-end">
        <button onClick={() => onFini()} className="text-dim text-[13px] px-3 min-h-[44px]">
          Annuler
        </button>
        <button
          onClick={() => creer.mutate()}
          disabled={creer.isPending}
          className={cn('bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px]', creer.isPending && 'opacity-40')}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function DetailProjet({ projet: p, onFermer }: { projet: Projet; onFermer: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const avis = useDemanderAvis();
  const [edition, setEdition] = useState(false);
  const [titre, setTitre] = useState(p.titre);
  const [description, setDescription] = useState(p.description ?? '');
  const [notes, setNotes] = useState(p.notes ?? '');
  const [question, setQuestion] = useState('');
  const [confirmer, setConfirmer] = useState(false);

  const maj = useMutation({
    mutationFn: async (valeurs: Partial<Pick<Projet, 'titre' | 'description' | 'notes' | 'statut'>> & { actif?: boolean }) => {
      const { error } = await supabase.from('projets_perso').update(valeurs).eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: (_, valeurs) => {
      qc.invalidateQueries({ queryKey: ['projets-perso'] });
      if (valeurs.actif === false) {
        toast.success('Projet supprimé');
        onFermer();
      } else {
        toast.success('Projet mis à jour');
        setEdition(false);
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const enregistrer = () => {
    if (!titre.trim()) return toast.error('Le titre est obligatoire');
    maj.mutate({ titre: titre.trim(), description: description.trim() || null, notes: notes.trim() || null });
  };

  const enPreparation = avis.isPending || p.avis_statut === 'en_cours';
  const demander = () => {
    avis.mutate({ projetId: p.id, question: question.trim() || undefined }, { onSuccess: () => setQuestion('') });
  };

  return (
    <div className="p-4 md:p-6 md:px-7 max-w-[900px]">
      <button onClick={onFermer} className="text-nikito-cyan text-[13px] font-semibold min-h-[44px] mb-2">
        ← Mes projets
      </button>

      <div className="bg-bg-card rounded-xl border border-white/[0.06] p-4 grid gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {p.origine === 'alba' && <span className="text-[11px] px-2 py-0.5 rounded bg-nikito-violet/15 text-nikito-violet">Proposé par ALBA</span>}
          <span className="text-[11px] text-faint">Créé le {dateFr(p.cree_le)}</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(STATUTS) as Statut[]).map((s) => (
            <Pill key={s} active={p.statut === s} onClick={() => p.statut !== s && maj.mutate({ statut: s })}>
              {STATUTS[s].label}
            </Pill>
          ))}
        </div>

        {edition ? (
          <>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={160} className={cn(champ, 'text-[15px] font-semibold')} />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={6000}
              placeholder="Description du projet"
              className={cn(champ, 'resize-y')}
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              maxLength={10000}
              placeholder="Tes notes : avancement, devis, contacts, décisions…"
              className={cn(champ, 'resize-y')}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEdition(false)} className="text-dim text-[13px] px-3 min-h-[44px]">
                Annuler
              </button>
              <button
                onClick={enregistrer}
                disabled={maj.isPending}
                className={cn('bg-nikito-cyan text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[44px]', maj.isPending && 'opacity-50')}
              >
                Enregistrer
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[18px] font-semibold m-0 leading-tight">{p.titre}</h1>
            {p.description ? (
              <div className="text-[13px] text-text/90 whitespace-pre-wrap">{p.description}</div>
            ) : (
              <div className="text-[13px] text-faint">Pas encore de description.</div>
            )}
            {p.notes && (
              <div className="text-[13px] bg-bg-deep rounded-lg p-3 whitespace-pre-wrap">
                <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Mes notes</div>
                {p.notes}
              </div>
            )}
            <button
              onClick={() => setEdition(true)}
              className="self-start bg-nikito-cyan/12 border border-nikito-cyan/45 text-nikito-cyan px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px]"
            >
              ✏️ Modifier / ajouter des notes
            </button>
          </>
        )}
      </div>

      <div className="mt-4 bg-bg-card rounded-xl border border-nikito-violet/30 p-4 grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold m-0">L’avis d’ALBA</h2>
          {p.avis_le && !enPreparation && <span className="text-[11px] text-faint">le {dateFr(p.avis_le)}</span>}
        </div>

        {enPreparation ? (
          <div className="text-[13px] text-nikito-cyan animate-pulse">ALBA étudie ton projet… (1 à 2 minutes)</div>
        ) : p.avis ? (
          <BlocAvis avis={p.avis} />
        ) : (
          <div className="text-[13px] text-dim">Pas encore d’avis sur ce projet.</div>
        )}
        {p.avis_statut === 'echec' && p.avis_erreur && !enPreparation && (
          <div className="text-[12px] text-red">Dernière demande impossible : {p.avis_erreur}</div>
        )}

        <div className="grid gap-2 pt-1 border-t border-white/[0.06]">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Une question ou une précision pour ALBA ? (facultatif — ex. « Et si je le fais avec un seul technicien ? »)"
            className={cn(champ, 'resize-none')}
          />
          <button
            onClick={demander}
            disabled={enPreparation}
            className={cn(
              'self-end bg-nikito-violet/15 border border-nikito-violet/50 text-nikito-violet px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]',
              enPreparation && 'opacity-40'
            )}
          >
            {question.trim() ? 'Poser la question' : p.avis ? '↻ Redemander l’avis' : '💡 Demander l’avis d’ALBA'}
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        {confirmer ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setConfirmer(false)} className="text-dim text-[13px] min-h-[44px]">
              Garder
            </button>
            <button onClick={() => maj.mutate({ actif: false })} className="text-red text-[13px] font-semibold min-h-[44px]">
              Confirmer la suppression
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmer(true)} className="text-dim text-[13px] min-h-[44px]">
            Supprimer le projet
          </button>
        )}
      </div>
    </div>
  );
}

function Liste({ titre, items, classe }: { titre: string; items: string[]; classe?: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className={cn('text-[11px] uppercase tracking-wider mb-1', classe ?? 'text-dim')}>{titre}</div>
      <ul className="m-0 pl-4 grid gap-1 text-[13px] list-disc">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function BlocAvis({ avis: a }: { avis: Avis }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('text-[12px] px-2 py-0.5 rounded font-semibold', FAISABILITE[a.faisabilite].classe)}>{FAISABILITE[a.faisabilite].label}</span>
        <Interet valeur={a.interet} />
      </div>
      <div className="text-[15px] font-semibold">« {a.verdict} »</div>
      <div className="text-[13px] text-text/90">{a.resume}</div>

      {a.question && a.reponse_question && (
        <div className="bg-bg-deep rounded-lg p-3 text-[13px] grid gap-1">
          <div className="text-dim">Ta question : {a.question}</div>
          <div>{a.reponse_question}</div>
        </div>
      )}

      {(a.budget_estime || a.delai_estime) && (
        <div className="grid sm:grid-cols-2 gap-2">
          {a.budget_estime && (
            <div className="bg-bg-deep rounded-lg p-3">
              <div className="text-[11px] text-dim uppercase tracking-wider">Budget estimé</div>
              <div className="text-[13px] mt-0.5">{a.budget_estime}</div>
            </div>
          )}
          {a.delai_estime && (
            <div className="bg-bg-deep rounded-lg p-3">
              <div className="text-[11px] text-dim uppercase tracking-wider">Délai estimé</div>
              <div className="text-[13px] mt-0.5">{a.delai_estime}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Liste titre="Points forts" items={a.points_forts} classe="text-green" />
        <Liste titre="Risques" items={a.risques} classe="text-red" />
      </div>

      {a.etapes?.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider mb-1 text-nikito-cyan">Étapes</div>
          <ol className="m-0 pl-5 grid gap-1.5 text-[13px] list-decimal">
            {a.etapes.map((e, i) => (
              <li key={i}>
                <span className="font-semibold">{e.titre}</span>
                {e.detail && <span className="text-dim"> — {e.detail}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Liste titre="Ressources nécessaires" items={a.ressources} />
        <Liste titre="À clarifier" items={a.questions} classe="text-amber" />
      </div>
      <Liste titre="Pour l’améliorer" items={a.ameliorations} classe="text-nikito-violet" />
    </div>
  );
}
