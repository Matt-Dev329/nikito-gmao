import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import { ROLES_DIRECTION_PARC, aAcces } from '@/lib/acces';
import { DOMAINES_PRESTATAIRES } from '@/lib/domainesPrestataires';
import { useFiltreParc } from '@/hooks/useParcCourant';
import { FiltreParcPills } from '@/components/ui/FiltreParcPills';

const BUCKET = 'alba-techniques';
const TAILLE_MAX = 50 * 1024 * 1024;

type TypeDemande = 'intervention' | 'specifique';
type Statut = 'a_envoyer' | 'envoyee' | 'planifiee' | 'realisee' | 'annulee';

interface Demande {
  id: string;
  parc_id: string;
  type: TypeDemande;
  prestataire: string | null;
  domaine: string | null;
  objet: string;
  description: string | null;
  urgente: boolean;
  date_souhaitee: string | null;
  date_prevue: string | null;
  statut: Statut;
  suivi: string | null;
  piece_chemin: string | null;
  piece_nom: string | null;
  cree_le: string;
  realisee_le: string | null;
  parc: { code: string; nom: string } | null;
  auteur: { prenom: string; nom: string } | null;
}

const TYPES: Record<TypeDemande, string> = {
  intervention: 'Demande d’intervention',
  specifique: 'Demande spécifique',
};

const STATUTS: Record<Statut, { label: string; classe: string }> = {
  a_envoyer: { label: 'À envoyer', classe: 'bg-amber/15 text-amber' },
  envoyee: { label: 'Envoyée', classe: 'bg-nikito-cyan/15 text-nikito-cyan' },
  planifiee: { label: 'Planifiée', classe: 'bg-nikito-cyan/15 text-nikito-cyan' },
  realisee: { label: 'Réalisée', classe: 'bg-green/15 text-green' },
  annulee: { label: 'Annulée', classe: 'bg-white/[0.06] text-dim' },
};
const EN_COURS: Statut[] = ['a_envoyer', 'envoyee', 'planifiee'];

type FiltreStatut = 'en_cours' | 'realisee' | 'annulee' | 'toutes';
const FILTRES: [FiltreStatut, string][] = [
  ['en_cours', 'En cours'],
  ['realisee', 'Réalisées'],
  ['annulee', 'Annulées'],
  ['toutes', 'Toutes'],
];

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';
const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR');
const parcDe = (d: Demande) => (d.parc ? `${d.parc.code} · ${d.parc.nom}` : '—');
const correspondStatut = (d: Demande, f: FiltreStatut) =>
  f === 'toutes' || (f === 'en_cours' ? EN_COURS.includes(d.statut) : d.statut === f);

function useDemandes() {
  return useQuery({
    queryKey: ['demandes-prestataires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandes_prestataires')
        .select('*, parc:parcs(code, nom), auteur:utilisateurs!demandes_prestataires_cree_par_id_fkey(prenom, nom)')
        .eq('actif', true)
        .order('cree_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Demande[];
    },
  });
}

/** Demandes spécifiques et demandes d'intervention aux prestataires, réservées aux directeurs de parc. */
export function PageDemandesPrestataires() {
  const { utilisateur } = useAuth();
  if (utilisateur && !aAcces(utilisateur, ROLES_DIRECTION_PARC)) return <Navigate to="/" replace />;
  return <ContenuDemandes />;
}

function ContenuDemandes() {
  const { data: demandes, isLoading, isError, error } = useDemandes();
  const [ajout, setAjout] = useState(false);
  const [filtre, setFiltre] = useState<FiltreStatut>('en_cours');
  const [type, setType] = useState<TypeDemande | null>(null);
  const [parc, setParc] = useFiltreParc(null, 'libelle');
  const [recherche, setRecherche] = useState('');

  const parcsDispo = useMemo(() => {
    const m = new Map<string, number>();
    (demandes ?? []).filter((d) => correspondStatut(d, filtre)).forEach((d) => m.set(parcDe(d), (m.get(parcDe(d)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [demandes, filtre]);
  const parcActif = parc;

  const groupes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const m = new Map<string, Demande[]>();
    (demandes ?? [])
      .filter((d) => correspondStatut(d, filtre))
      .filter((d) => !type || d.type === type)
      .filter((d) => !parcActif || parcDe(d) === parcActif)
      .filter((d) => !q || [d.objet, d.description, d.prestataire, d.domaine, d.suivi].filter(Boolean).join(' ').toLowerCase().includes(q))
      // Urgentes d'abord, puis les plus récentes
      .sort((a, b) => Number(b.urgente) - Number(a.urgente) || b.cree_le.localeCompare(a.cree_le))
      .forEach((d) => m.set(parcDe(d), [...(m.get(parcDe(d)) ?? []), d]));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [demandes, filtre, type, parcActif, recherche]);

  const compte = (f: FiltreStatut) => (demandes ?? []).filter((d) => correspondStatut(d, f)).length;

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Demandes prestataires</h1>
          <p className="text-[13px] text-dim mt-1">
            Demandes d’intervention et demandes spécifiques aux prestataires, avec leur suivi — réservé aux directeurs de parc
          </p>
        </div>
        {!ajout && (
          <button
            onClick={() => setAjout(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
          >
            + Nouvelle demande
          </button>
        )}
      </div>

      {ajout && <FormulaireDemande onFini={() => setAjout(false)} />}

      <div className="flex flex-col gap-3 mb-4">
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (objet, prestataire, domaine…)"
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTRES.map(([f, label]) => (
            <Pill key={f} variant="cyan" active={filtre === f} onClick={() => setFiltre(f)}>
              {label} <span className="opacity-60">· {compte(f)}</span>
            </Pill>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Pill active={!type} onClick={() => setType(null)}>
            Tous types
          </Pill>
          {(Object.keys(TYPES) as TypeDemande[]).map((t) => (
            <Pill key={t} active={type === t} onClick={() => setType(t)}>
              {TYPES[t]}
            </Pill>
          ))}
        </div>
        <FiltreParcPills parcs={parcsDispo} actif={parcActif} onChange={setParc} />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : groupes.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">Aucune demande ici.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupes.map(([g, ds]) => (
            <section key={g}>
              <h2 className="text-[13px] text-dim uppercase tracking-wider mb-2">
                {g} <span className="text-faint">· {ds.length}</span>
              </h2>
              <ListeDemandes demandes={ds} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ListeDemandes({ demandes }: { demandes: Demande[] }) {
  const { data: urls } = useSignedUrls(
    demandes.map((d) => d.piece_chemin),
    BUCKET
  );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {demandes.map((d) => (
        <CarteDemande key={d.id} demande={d} url={d.piece_chemin ? urls?.[d.piece_chemin] : undefined} />
      ))}
    </div>
  );
}

function CarteDemande({ demande: d, url }: { demande: Demande; url?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [edition, setEdition] = useState(false);
  const [statut, setStatut] = useState<Statut>(d.statut);
  const [datePrevue, setDatePrevue] = useState(d.date_prevue ?? '');
  const [suivi, setSuivi] = useState(d.suivi ?? '');
  const [confirmer, setConfirmer] = useState(false);

  const maj = useMutation({
    mutationFn: async (valeurs: Partial<Pick<Demande, 'statut' | 'date_prevue' | 'suivi'>> & { actif?: boolean }) => {
      const { error } = await supabase.from('demandes_prestataires').update(valeurs).eq('id', d.id);
      if (error) throw error;
    },
    onSuccess: (_, valeurs) => {
      toast.success(valeurs.actif === false ? 'Demande retirée' : 'Demande mise à jour');
      setEdition(false);
      qc.invalidateQueries({ queryKey: ['demandes-prestataires'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const enregistrer = () =>
    maj.mutate({ statut, date_prevue: datePrevue || null, suivi: suivi.trim() || null });

  return (
    <div className={cn('bg-bg-card rounded-xl border p-4 flex flex-col gap-2', d.urgente && EN_COURS.includes(d.statut) ? 'border-red/40' : 'border-white/[0.06]')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('text-[11px] px-2 py-0.5 rounded font-semibold', STATUTS[d.statut].classe)}>{STATUTS[d.statut].label}</span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-dim">{TYPES[d.type]}</span>
        {d.urgente && <span className="text-[11px] px-2 py-0.5 rounded bg-red/15 text-red font-semibold">Urgent</span>}
      </div>
      <div className="text-[15px] font-semibold leading-tight">{d.objet}</div>
      <div className="text-[12px] text-dim">
        {[d.prestataire, d.domaine].filter(Boolean).join(' · ') || 'Prestataire non précisé'}
      </div>
      {d.description && <div className="text-[13px] text-text/90 whitespace-pre-wrap">{d.description}</div>}
      <div className="text-[11px] text-faint flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          Créée le {dateFr(d.cree_le)}
          {d.auteur ? ` par ${d.auteur.prenom} ${d.auteur.nom}` : ''}
        </span>
        {d.date_souhaitee && <span>Souhaitée pour le {dateFr(d.date_souhaitee)}</span>}
        {d.date_prevue && <span className="text-nikito-cyan">Prévue le {dateFr(d.date_prevue)}</span>}
        {d.realisee_le && <span className="text-green">Réalisée le {dateFr(d.realisee_le)}</span>}
      </div>
      {d.suivi && !edition && (
        <div className="text-[12px] bg-bg-deep rounded-lg p-2.5 whitespace-pre-wrap">
          <span className="text-dim">Suivi : </span>
          {d.suivi}
        </div>
      )}
      {d.piece_chemin && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={cn('self-start text-[12px] text-nikito-cyan underline-offset-2 hover:underline', !url && 'opacity-40 pointer-events-none')}
        >
          📎 {d.piece_nom ?? 'Pièce jointe'}
        </a>
      )}

      {edition ? (
        <div className="grid gap-2 pt-1">
          <div className="grid sm:grid-cols-2 gap-2">
            <select value={statut} onChange={(e) => setStatut(e.target.value as Statut)} className={champ}>
              {(Object.keys(STATUTS) as Statut[]).map((s) => (
                <option key={s} value={s}>
                  {STATUTS[s].label}
                </option>
              ))}
            </select>
            <label className="grid gap-1">
              <span className="text-[11px] text-dim">Date prévue par le prestataire</span>
              <input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} className={champ} />
            </label>
          </div>
          <textarea
            value={suivi}
            onChange={(e) => setSuivi(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Suivi (devis reçu, relance, réponse du prestataire…)"
            className={cn(champ, 'resize-none')}
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
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-1 mt-auto">
          <button
            onClick={() => setEdition(true)}
            className="bg-nikito-cyan/12 border border-nikito-cyan/45 text-nikito-cyan px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px]"
          >
            Mettre à jour le suivi
          </button>
          {confirmer ? (
            <button onClick={() => maj.mutate({ actif: false })} className="text-red text-[12px] font-semibold min-h-[36px]">
              Confirmer le retrait
            </button>
          ) : (
            <button onClick={() => setConfirmer(true)} className="text-dim text-[12px] min-h-[36px]">
              Retirer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FormulaireDemande({ onFini }: { onFini: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const { data: tousParcs } = useParcs();
  // Un directeur de parc ne crée des demandes que pour ses parcs
  const parcs = ((tousParcs ?? []) as Array<{ id: string; code: string; nom: string }>).filter(
    (p) => utilisateur?.role_code !== 'directeur_parc' || utilisateur.parc_ids.includes(p.id)
  );
  const [parcId, setParcId] = useState(utilisateur?.parc_ids?.length === 1 ? utilisateur.parc_ids[0] : '');
  const [type, setType] = useState<TypeDemande>('intervention');
  const [prestataire, setPrestataire] = useState('');
  const [domaine, setDomaine] = useState('');
  const [objet, setObjet] = useState('');
  const [description, setDescription] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [dateSouhaitee, setDateSouhaitee] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);

  // Prestataires déjà connus (contrats, rapports, anciennes demandes)
  const { data: prestatairesConnus } = useQuery({
    queryKey: ['prestataires-connus'],
    queryFn: async () => {
      const [{ data: docs }, { data: dem }] = await Promise.all([
        supabase.from('documents_techniques').select('prestataire').in('type', ['prestataire', 'contrat']).eq('actif', true),
        supabase.from('demandes_prestataires').select('prestataire').eq('actif', true),
      ]);
      return [...new Set([...(docs ?? []), ...(dem ?? [])].map((r) => (r.prestataire ?? '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'fr')
      );
    },
  });

  const envoyer = useMutation({
    mutationFn: async () => {
      if (!parcId) throw new Error('Choisis le parc');
      if (!objet.trim()) throw new Error('Indique l’objet de la demande');
      if (fichier && fichier.size > TAILLE_MAX) throw new Error('Pièce jointe trop lourde (50 Mo maximum)');
      let piece: { piece_chemin: string; piece_nom: string } | null = null;
      if (fichier) {
        const code = parcs.find((p) => p.id === parcId)?.code ?? 'commun';
        const nomPropre = fichier.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
        const chemin = `demande/${code}/${Date.now()}_${nomPropre}`;
        const { error: errEnvoi } = await supabase.storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type || undefined });
        if (errEnvoi) throw errEnvoi;
        piece = { piece_chemin: chemin, piece_nom: fichier.name };
      }
      const { error } = await supabase.from('demandes_prestataires').insert({
        parc_id: parcId,
        type,
        prestataire: prestataire.trim() || null,
        domaine: domaine.trim() || null,
        objet: objet.trim(),
        description: description.trim() || null,
        urgente,
        date_souhaitee: dateSouhaitee || null,
        ...(piece ?? {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Demande enregistrée');
      qc.invalidateQueries({ queryKey: ['demandes-prestataires'] });
      qc.invalidateQueries({ queryKey: ['prestataires-connus'] });
      onFini();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="bg-bg-card rounded-xl border border-nikito-cyan/30 p-4 mb-4 grid gap-2.5 max-w-[640px]">
      <div className="text-[14px] font-semibold">Nouvelle demande</div>
      <div className="flex gap-1.5">
        {(Object.keys(TYPES) as TypeDemande[]).map((t) => (
          <Pill key={t} variant="cyan" active={type === t} onClick={() => setType(t)}>
            {TYPES[t]}
          </Pill>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5">
        <select value={parcId} onChange={(e) => setParcId(e.target.value)} className={champ}>
          <option value="">Parc…</option>
          {parcs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.nom}
            </option>
          ))}
        </select>
        <input value={domaine} onChange={(e) => setDomaine(e.target.value)} list="domaines-demande" placeholder="Domaine (ex. Extincteurs)" className={champ} />
        <datalist id="domaines-demande">
          {DOMAINES_PRESTATAIRES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <input
        value={prestataire}
        onChange={(e) => setPrestataire(e.target.value)}
        list="prestataires-demande"
        placeholder="Prestataire (ex. Bataille & Renard)"
        className={champ}
      />
      <datalist id="prestataires-demande">
        {(prestatairesConnus ?? []).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <input
        value={objet}
        onChange={(e) => setObjet(e.target.value)}
        maxLength={200}
        placeholder={type === 'intervention' ? 'Objet (ex. Remplacer les ressorts cassés zone trampoline)' : 'Objet (ex. Devis pour un nouveau filet)'}
        className={champ}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Détail de la demande (facultatif)"
        className={cn(champ, 'resize-none')}
      />
      <div className="grid sm:grid-cols-2 gap-2.5 items-end">
        <label className="grid gap-1">
          <span className="text-[11px] text-dim">Date souhaitée (facultatif)</span>
          <input type="date" value={dateSouhaitee} onChange={(e) => setDateSouhaitee(e.target.value)} className={champ} />
        </label>
        <label className="flex items-center gap-2 min-h-[44px] text-[13px] cursor-pointer">
          <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} className="w-5 h-5 accent-red" />
          Urgent
        </label>
      </div>
      <input
        type="file"
        accept="application/pdf,image/*"
        onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
        className="text-[13px] text-dim file:mr-3 file:rounded-lg file:border-0 file:bg-nikito-cyan/15 file:text-nikito-cyan file:px-3 file:py-2"
      />
      <div className="text-[11px] text-faint">Pièce jointe facultative (devis, photo, PDF), jusqu’à 50 Mo</div>
      <div className="flex gap-2 justify-end">
        <button onClick={onFini} className="text-dim text-[13px] px-3 min-h-[44px]">
          Annuler
        </button>
        <button
          onClick={() => envoyer.mutate()}
          disabled={envoyer.isPending}
          className={cn('bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px]', envoyer.isPending && 'opacity-40')}
        >
          {envoyer.isPending ? 'Envoi…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
