import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { aujourdhuiParis } from '@/lib/dates';
import { telechargerUrl } from '@/lib/telecharger';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import type { AlbaBucket } from '@/lib/uploadPhotoControle';
import { ROLES_FORMATIONS } from '@/lib/acces';

const BUCKET: AlbaBucket = 'alba-formations';
const SEUIL_RECYCLAGE_JOURS = 60;

/** Formations courantes et durée de validité usuelle (mois) pour proposer la date de recyclage */
const FORMATIONS_TYPES: { intitule: string; mois: number | null }[] = [
  { intitule: 'SST (Sauveteur Secouriste du Travail)', mois: 24 },
  { intitule: 'MAC SST (recyclage)', mois: 24 },
  { intitule: 'Habilitation électrique B0 / H0V', mois: 36 },
  { intitule: 'Habilitation électrique BS / BE manœuvre', mois: 36 },
  { intitule: 'Habilitation électrique BR / B1V / B2V', mois: 36 },
  { intitule: 'Manipulation des extincteurs / EPI', mois: 12 },
  { intitule: 'Évacuation — guide-file et serre-file', mois: 12 },
  { intitule: 'SSIAP 1', mois: 36 },
  { intitule: 'PSC1 (premiers secours)', mois: null },
  { intitule: 'Travail en hauteur / port du harnais', mois: 36 },
  { intitule: 'CACES nacelle (R486)', mois: 60 },
  { intitule: 'Gestes et postures', mois: null },
  { intitule: 'Surveillance trampoline', mois: 12 },
  { intitule: 'HACCP / hygiène alimentaire', mois: null },
];

interface Formation {
  id: string;
  parc_id: string | null;
  personne: string;
  poste: string | null;
  intitule: string;
  organisme: string | null;
  date_formation: string;
  date_expiration: string | null;
  attestation: string | null;
  notes: string | null;
  parc: { code: string; nom: string } | null;
}

type Etat = 'a_jour' | 'a_renouveler' | 'expiree' | 'sans_limite';

function etatDe(f: Formation, aujourdhui: string): Etat {
  if (!f.date_expiration) return 'sans_limite';
  if (f.date_expiration < aujourdhui) return 'expiree';
  const jours = (new Date(f.date_expiration).getTime() - new Date(aujourdhui).getTime()) / 86_400_000;
  return jours <= SEUIL_RECYCLAGE_JOURS ? 'a_renouveler' : 'a_jour';
}

const BADGES: Record<Etat, { label: string; classe: string }> = {
  a_jour: { label: 'À jour', classe: 'bg-green/15 text-green' },
  a_renouveler: { label: 'À renouveler', classe: 'bg-amber/15 text-amber' },
  expiree: { label: 'Expirée', classe: 'bg-red/15 text-red' },
  sans_limite: { label: 'Sans échéance', classe: 'bg-white/[0.06] text-dim' },
};

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

function ajouterMois(date: string, mois: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + mois);
  return d.toISOString().slice(0, 10);
}

function useFormations() {
  return useQuery({
    queryKey: ['formations-personnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formations_personnel')
        .select('*, parc:parcs(code, nom)')
        .eq('actif', true)
        .order('personne')
        .order('date_formation', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Formation[];
    },
  });
}

/** Registre des formations du personnel de tous les parcs, avec alertes de recyclage. */
export function PageFormationsPersonnel() {
  const { utilisateur } = useAuth();
  if (utilisateur && !ROLES_FORMATIONS.includes(utilisateur.role_code)) return <Navigate to="/" replace />;
  return <ContenuFormations />;
}

function ContenuFormations() {
  const aujourdhui = aujourdhuiParis();
  const { data: formations, isLoading, isError, error } = useFormations();
  const [ajout, setAjout] = useState(false);
  const [parc, setParc] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat | 'tous'>('tous');
  const [recherche, setRecherche] = useState('');
  const [vue, setVue] = useState<'personne' | 'formation'>('personne');

  // Seule la formation la plus récente compte pour une même personne et un même intitulé
  const actuelles = useMemo(() => {
    const vues = new Set<string>();
    return (formations ?? []).filter((f) => {
      const cle = `${f.personne.toLowerCase()}|${f.intitule.toLowerCase()}`;
      if (vues.has(cle)) return false;
      vues.add(cle);
      return true;
    });
  }, [formations]);

  const parcs = useMemo(() => {
    const m = new Map<string, number>();
    actuelles.forEach((f) => m.set(f.parc?.code ?? 'Sans parc', (m.get(f.parc?.code ?? 'Sans parc') ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [actuelles]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return actuelles.filter(
      (f) =>
        (!parc || (f.parc?.code ?? 'Sans parc') === parc) &&
        (etat === 'tous' || etatDe(f, aujourdhui) === etat) &&
        (!q || [f.personne, f.poste, f.intitule, f.organisme, f.parc?.code].filter(Boolean).join(' ').toLowerCase().includes(q))
    );
  }, [actuelles, parc, etat, recherche, aujourdhui]);

  const groupes = useMemo(() => {
    const m = new Map<string, Formation[]>();
    filtrees.forEach((f) => {
      const cle = vue === 'personne' ? `${f.personne}${f.parc ? ` · ${f.parc.code}` : ''}` : f.intitule;
      m.set(cle, [...(m.get(cle) ?? []), f]);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [filtrees, vue]);

  const compte = (e: Etat | 'tous') => (e === 'tous' ? actuelles.length : actuelles.filter((f) => etatDe(f, aujourdhui) === e).length);

  const exporterCsv = () => {
    const lignes = [
      ['Parc', 'Personne', 'Poste', 'Formation', 'Organisme', 'Date', 'Expiration', 'État'],
      ...filtrees.map((f) => [
        f.parc?.code ?? '',
        f.personne,
        f.poste ?? '',
        f.intitule,
        f.organisme ?? '',
        f.date_formation,
        f.date_expiration ?? '',
        BADGES[etatDe(f, aujourdhui)].label,
      ]),
    ];
    const csv = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const lien = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = lien;
    a.download = `formations_${aujourdhui}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(lien), 60_000);
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Formations du personnel</h1>
          <p className="text-[13px] text-dim mt-1">Formations de toutes les équipes de tous les parcs, attestations et recyclages</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exporterCsv} className="bg-bg-deep border border-white/[0.08] px-4 rounded-[10px] text-[13px] min-h-[44px]">
            ⬇ Export
          </button>
          {!ajout && (
            <button onClick={() => setAjout(true)} className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]">
              + Ajouter une formation
            </button>
          )}
        </div>
      </div>

      {ajout && <FormulaireFormation onFini={() => setAjout(false)} />}

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(['tous', 'expiree', 'a_renouveler', 'a_jour', 'sans_limite'] as const).map((e) => (
            <Pill key={e} active={etat === e} onClick={() => setEtat(e)}>
              {e === 'tous' ? 'Toutes' : BADGES[e].label} <span className="opacity-60">· {compte(e)}</span>
            </Pill>
          ))}
        </div>
        {parcs.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={!parc} onClick={() => setParc(null)}>
              Tous les parcs
            </Pill>
            {parcs.map(([p, n]) => (
              <Pill key={p} variant="cyan" active={parc === p} onClick={() => setParc(p)}>
                {p} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (personne, formation, poste…)"
            className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
          <select value={vue} onChange={(e) => setVue(e.target.value as 'personne' | 'formation')} className={cn(champ, 'w-auto')}>
            <option value="personne">Par personne</option>
            <option value="formation">Par formation</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : groupes.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">Aucune formation enregistrée.</div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupes.map(([g, liste]) => (
            <section key={g}>
              <h2 className="text-[13px] text-dim uppercase tracking-wider mb-2">
                {g} <span className="text-faint">· {liste.length}</span>
              </h2>
              <div className="grid gap-2">
                {liste.map((f) => (
                  <LigneFormation key={f.id} formation={f} vue={vue} aujourdhui={aujourdhui} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LigneFormation({ formation: f, vue, aujourdhui }: { formation: Formation; vue: 'personne' | 'formation'; aujourdhui: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmer, setConfirmer] = useState(false);
  const badge = BADGES[etatDe(f, aujourdhui)];

  const telechargerAttestation = async () => {
    if (!f.attestation) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.attestation, 600);
    if (error || !data) {
      toast.error('Attestation indisponible');
      return;
    }
    const ext = f.attestation.match(/\.[a-z0-9]+$/i)?.[0] ?? '';
    await telechargerUrl(data.signedUrl, `${f.personne}_${f.intitule}`.normalize('NFD').replace(/[^\w.-]+/g, '_') + ext);
  };

  const retirer = async () => {
    const { error } = await supabase.from('formations_personnel').update({ actif: false }).eq('id', f.id);
    if (error) toast.error(error.message);
    else {
      toast.info('Formation retirée');
      qc.invalidateQueries({ queryKey: ['formations-personnel'] });
    }
  };

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06] p-3 px-4 flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold">{vue === 'personne' ? f.intitule : `${f.personne}${f.parc ? ` · ${f.parc.code}` : ''}`}</div>
        <div className="text-[12px] text-dim mt-0.5">
          {[
            f.poste,
            f.organisme,
            `le ${new Date(f.date_formation).toLocaleDateString('fr-FR')}`,
            f.date_expiration ? `valable jusqu’au ${new Date(f.date_expiration).toLocaleDateString('fr-FR')}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-[10px] px-2 py-0.5 rounded', badge.classe)}>{badge.label}</span>
        {f.attestation && (
          <button onClick={telechargerAttestation} className="text-nikito-cyan text-[12px] font-semibold min-h-[36px] px-1">
            ⬇ Attestation
          </button>
        )}
        {confirmer ? (
          <button onClick={retirer} className="text-red text-[12px] font-semibold min-h-[36px] px-1">
            Confirmer
          </button>
        ) : (
          <button onClick={() => setConfirmer(true)} className="text-dim text-[12px] min-h-[36px] px-1">
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}

function FormulaireFormation({ onFini }: { onFini: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const { data: parcs } = useParcs();
  const [parcId, setParcId] = useState(utilisateur?.parc_ids?.length === 1 ? utilisateur.parc_ids[0] : '');
  const [personne, setPersonne] = useState('');
  const [poste, setPoste] = useState('');
  const [intitule, setIntitule] = useState('');
  const [organisme, setOrganisme] = useState('');
  const [date, setDate] = useState(aujourdhuiParis());
  const [expiration, setExpiration] = useState('');
  const [notes, setNotes] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);

  // Propose la date de recyclage selon la formation choisie
  const choisirIntitule = (valeur: string) => {
    setIntitule(valeur);
    const type = FORMATIONS_TYPES.find((t) => t.intitule === valeur);
    if (type?.mois && date && !expiration) setExpiration(ajouterMois(date, type.mois));
  };

  const enregistrer = useMutation({
    mutationFn: async () => {
      if (!personne.trim()) throw new Error('Indique le nom de la personne');
      if (!intitule.trim()) throw new Error('Indique la formation');
      if (!date) throw new Error('Indique la date de la formation');
      if (fichier && fichier.size > 25 * 1024 * 1024) throw new Error('Attestation trop lourde (25 Mo maximum)');
      let attestation: string | null = null;
      if (fichier) {
        const nom = fichier.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-60);
        attestation = `${new Date().getFullYear()}/${crypto.randomUUID()}_${nom}`;
        const { error } = await supabase.storage.from(BUCKET).upload(attestation, fichier, { contentType: fichier.type || 'application/pdf' });
        if (error) throw error;
      }
      const { error } = await supabase.from('formations_personnel').insert({
        parc_id: parcId || null,
        personne: personne.trim(),
        poste: poste.trim() || null,
        intitule: intitule.trim(),
        organisme: organisme.trim() || null,
        date_formation: date,
        date_expiration: expiration || null,
        attestation,
        notes: notes.trim() || null,
        cree_par_id: utilisateur?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Formation enregistrée');
      qc.invalidateQueries({ queryKey: ['formations-personnel'] });
      onFini();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="bg-bg-card rounded-xl border border-nikito-cyan/30 p-4 mb-5 grid gap-2.5 max-w-[720px]">
      <div className="text-[15px] font-semibold">Nouvelle formation</div>
      <div className="grid sm:grid-cols-2 gap-2.5">
        <input value={personne} onChange={(e) => setPersonne(e.target.value)} placeholder="Nom et prénom" className={champ} />
        <input value={poste} onChange={(e) => setPoste(e.target.value)} placeholder="Poste (ex. Technicien, Animateur)" className={champ} />
        <select value={parcId} onChange={(e) => setParcId(e.target.value)} className={champ}>
          <option value="">Parc…</option>
          {((parcs ?? []) as Array<{ id: string; code: string; nom: string }>).map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.nom}
            </option>
          ))}
        </select>
        <input value={intitule} onChange={(e) => choisirIntitule(e.target.value)} list="formations-types" placeholder="Formation (ex. SST)" className={champ} />
        <datalist id="formations-types">
          {FORMATIONS_TYPES.map((t) => (
            <option key={t.intitule} value={t.intitule} />
          ))}
        </datalist>
        <input value={organisme} onChange={(e) => setOrganisme(e.target.value)} placeholder="Organisme de formation" className={champ} />
        <div className="grid grid-cols-2 gap-2.5">
          <label className="grid gap-1">
            <span className="text-[11px] text-dim">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] text-dim">Valable jusqu’au</span>
            <input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} className={champ} />
          </label>
        </div>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (facultatif)" className={cn(champ, 'resize-none')} />
      <div className="grid gap-1">
        <span className="text-[11px] text-dim">Attestation (PDF ou photo, facultatif)</span>
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
          className="text-[13px] text-dim file:mr-3 file:rounded-lg file:border-0 file:bg-nikito-cyan/15 file:text-nikito-cyan file:px-3 file:py-2"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onFini} className="text-dim text-[13px] px-3 min-h-[44px]">
          Annuler
        </button>
        <button
          onClick={() => enregistrer.mutate()}
          disabled={enregistrer.isPending}
          className={cn('bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px]', enregistrer.isPending && 'opacity-40')}
        >
          {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
