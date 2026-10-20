import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn, estCheminVideo } from '@/lib/utils';
import { dateParis } from '@/lib/dates';
import { envoyerFichier } from '@/lib/envoiGrosFichier';
import { nomDepuisChemin } from '@/lib/telecharger';
import { useAuth } from '@/hooks/useAuth';
import { useFormationFilter } from '@/hooks/useFormation';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useCatalogueCommandes } from '@/hooks/queries/useCommandes';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import { ZoneSignature } from '@/components/ui/ZoneSignature';
import { BoutonTelecharger } from '@/components/ui/BoutonTelecharger';
import { ROLES_BONS } from '@/lib/acces';
import { BUCKET_BONS, exportBonPDF, formatDuree, type BonIntervention } from './exportBonPDF';
import { CarteRapport } from './PageRapportsReparation';
import { useRapports, type Rapport } from '@/hooks/queries/useRapportsReparation';

// Bons hors ticket et interventions clôturées sur ticket, dans une même liste
type Element = { type: 'bon'; date: string; bon: BonIntervention } | { type: 'ticket'; date: string; rapport: Rapport };
type Source = 'tous' | 'bon' | 'ticket';

const PERIODES = [
  { code: '30', label: '30 jours', jours: 30 },
  { code: '90', label: '3 mois', jours: 90 },
  { code: '365', label: '1 an', jours: 365 },
  { code: 'tout', label: 'Tout', jours: 3650 },
];

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

const TAILLE_MAX_MEDIA = 50 * 1024 * 1024;
const AUTRE = '__autre__';

function useBons(jours: number) {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['bons-intervention', jours, estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bons_intervention')
        .select('*, parc:parcs(code, nom)')
        .eq('actif', true)
        .eq('est_formation', estFormation)
        .gte('date_intervention', dateParis(Date.now() - jours * 86_400_000))
        .order('date_intervention', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BonIntervention[];
    },
  });
}

/** Bons d'intervention : réparations réalisées hors ticket, remplies et signées sur place. */
export function PageBonsIntervention() {
  const { utilisateur } = useAuth();
  if (utilisateur && !ROLES_BONS.includes(utilisateur.role_code)) return <Navigate to="/" replace />;
  return <ContenuBons />;
}

function ContenuBons() {
  const [nouveau, setNouveau] = useState(false);
  const [periode, setPeriode] = useState('90');
  const [activite, setActivite] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [source, setSource] = useState<Source>('tous');
  const jours = PERIODES.find((p) => p.code === periode)?.jours ?? 90;
  const bonsQ = useBons(jours);
  const rapportsQ = useRapports(jours);
  const isLoading = bonsQ.isLoading || rapportsQ.isLoading;
  const isError = bonsQ.isError || rapportsQ.isError;
  const error = bonsQ.error ?? rapportsQ.error;

  const elements = useMemo<Element[]>(
    () =>
      [
        ...(bonsQ.data ?? []).map((bon) => ({ type: 'bon' as const, date: bon.date_intervention, bon })),
        ...(rapportsQ.data ?? []).map((rapport) => ({ type: 'ticket' as const, date: rapport.fin, rapport })),
      ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [bonsQ.data, rapportsQ.data]
  );
  const activiteDe = (e: Element) => (e.type === 'bon' ? e.bon.activite : e.rapport.activite) || 'Autres';
  const texteDe = (e: Element) =>
    (e.type === 'bon'
      ? [e.bon.numero, e.bon.activite, e.bon.equipement, e.bon.probleme, e.bon.travaux, e.bon.technicien_nom, e.bon.responsable_nom, e.bon.parc?.code, e.bon.parc?.nom]
      : [e.rapport.numero_bt, e.rapport.activite, e.rapport.equipement, e.rapport.equipement_code, e.rapport.diagnostic, e.rapport.actions, e.rapport.intervenant, e.rapport.parc_code, e.rapport.parc_nom]
    )
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  const deLaSource = useMemo(() => elements.filter((e) => source === 'tous' || e.type === source), [elements, source]);
  const activites = useMemo(() => {
    const m = new Map<string, number>();
    deLaSource.forEach((e) => m.set(activiteDe(e), (m.get(activiteDe(e)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => (a[0] === 'Autres' ? 1 : b[0] === 'Autres' ? -1 : a[0].localeCompare(b[0], 'fr')));
  }, [deLaSource]);
  const activiteActive = activite && activites.some(([a]) => a === activite) ? activite : null;

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return deLaSource.filter((e) => (!activiteActive || activiteDe(e) === activiteActive) && (!q || texteDe(e).includes(q)));
  }, [deLaSource, activiteActive, recherche]);
  const nbBons = elements.filter((e) => e.type === 'bon').length;

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Bons d'intervention</h1>
          <p className="text-[13px] text-dim mt-1">
            Toutes les interventions : bons hors ticket (signés sur place) et interventions clôturées sur ticket
          </p>
        </div>
        {!nouveau && (
          <button
            onClick={() => setNouveau(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
          >
            + Nouveau bon
          </button>
        )}
      </div>

      {nouveau && <FormulaireBon onFini={() => setNouveau(false)} />}

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PERIODES.map((p) => (
            <Pill key={p.code} active={periode === p.code} onClick={() => setPeriode(p.code)}>
              {p.label}
            </Pill>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(
            [
              ['tous', 'Tous', elements.length],
              ['bon', 'Hors ticket', nbBons],
              ['ticket', 'Sur ticket', elements.length - nbBons],
            ] as [Source, string, number][]
          ).map(([s, l, n]) => (
            <Pill key={s} active={source === s} onClick={() => setSource(s)}>
              {l} <span className="opacity-60">· {n}</span>
            </Pill>
          ))}
        </div>
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (numéro, équipement, travaux, technicien…)"
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
        />
        {activites.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={!activiteActive} onClick={() => setActivite(null)}>
              Toutes <span className="opacity-60">· {deLaSource.length}</span>
            </Pill>
            {activites.map(([a, n]) => (
              <Pill key={a} variant="cyan" active={activiteActive === a} onClick={() => setActivite(a)}>
                {a} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : filtres.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">Aucune intervention sur cette période.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtres.map((e) =>
            e.type === 'bon' ? <CarteBon key={`b:${e.bon.id}`} bon={e.bon} /> : <CarteRapport key={`t:${e.rapport.cle}`} rapport={e.rapport} />
          )}
        </div>
      )}
    </div>
  );
}

function CarteBon({ bon: b }: { bon: BonIntervention }) {
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [pdf, setPdf] = useState(false);
  const { data: urls } = useSignedUrls(ouvert ? b.medias : [], BUCKET_BONS);

  const telechargerPdf = async () => {
    setPdf(true);
    try {
      await exportBonPDF(b);
    } catch (e) {
      toast.error(`PDF impossible : ${(e as Error).message}`);
    } finally {
      setPdf(false);
    }
  };

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06]">
      <button onClick={() => setOuvert((o) => !o)} className="w-full text-left p-3.5 px-4 flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold truncate">{[b.activite, b.equipement].filter(Boolean).join(' · ') || 'Réparation'}</div>
          <div className="text-[12px] text-dim mt-0.5">
            <span className="font-mono">{b.numero}</span>
            {b.parc?.code ? ` · ${b.parc.code}` : ''} ·{' '}
            {new Date(b.date_intervention).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} ·{' '}
            {b.technicien_nom}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {b.medias.length > 0 && <span className="text-[11px] text-dim">📎 {b.medias.length}</span>}
          <span className="text-dim text-[12px]">{ouvert ? '▲' : '▼'}</span>
        </div>
      </button>

      {ouvert && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 grid gap-3 text-[13px]">
          {b.probleme && (
            <div>
              <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Problème constaté</div>
              <div className="whitespace-pre-line">{b.probleme}</div>
            </div>
          )}
          <div>
            <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Travaux réalisés</div>
            <div className="whitespace-pre-line">{b.travaux}</div>
          </div>
          {b.pieces && (
            <div>
              <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Pièces utilisées</div>
              <div className="whitespace-pre-line">{b.pieces}</div>
            </div>
          )}
          <div className="text-[12px] text-dim">
            Durée : {formatDuree(b.duree_minutes)} · Technicien : {b.technicien_nom} · Responsable : {b.responsable_nom}
          </div>
          {b.medias.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {b.medias.map((m) => {
                const url = urls?.[m];
                return (
                  <div key={m} className="relative">
                    {!url ? (
                      <div className="w-full aspect-[4/3] rounded-lg bg-bg-deep animate-pulse" />
                    ) : estCheminVideo(m) ? (
                      <video src={url} controls playsInline preload="metadata" className="w-full aspect-[4/3] rounded-lg bg-black" />
                    ) : (
                      <a href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover rounded-lg bg-bg-deep" />
                      </a>
                    )}
                    <BoutonTelecharger url={url} nom={nomDepuisChemin(m, b.numero ?? 'bon')} compact className="absolute top-1.5 right-1.5" />
                  </div>
                );
              })}
            </div>
          )}
          <div>
            <button
              onClick={telechargerPdf}
              disabled={pdf}
              className="bg-nikito-cyan/15 text-nikito-cyan border border-nikito-cyan/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
            >
              {pdf ? 'PDF…' : '⬇ Télécharger le bon (PDF)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function maintenantLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function FormulaireBon({ onFini }: { onFini: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const { estFormation } = useFormationFilter();
  const { data: parcs } = useParcs();
  const { data: catalogue } = useCatalogueCommandes();

  const [parcId, setParcId] = useState(utilisateur?.parc_ids?.length === 1 ? utilisateur.parc_ids[0] : '');
  const [activite, setActivite] = useState('');
  const [activiteLibre, setActiviteLibre] = useState(false);
  const { data: activitesEquipements } = useQuery({
    queryKey: ['activites-equipements'],
    queryFn: async () => {
      const { data } = await supabase.from('categories_equipement').select('activite').not('activite', 'is', null);
      return (data ?? []).map((c: { activite: string | null }) => c.activite ?? '').filter(Boolean);
    },
    staleTime: 10 * 60_000,
  });
  // Activités du catalogue + celles des équipements, sans doublon
  const listeActivites = useMemo(
    () =>
      [...new Set([...(catalogue?.activites ?? []).map((a) => a.nom), ...(activitesEquipements ?? [])].map((a) => a.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, 'fr')
      ),
    [catalogue, activitesEquipements]
  );
  const [equipement, setEquipement] = useState('');
  const [date, setDate] = useState(maintenantLocal);
  const [duree, setDuree] = useState('');
  const [probleme, setProbleme] = useState('');
  const [travaux, setTravaux] = useState('');
  const [pieces, setPieces] = useState('');
  const [medias, setMedias] = useState<File[]>([]);
  const [technicien, setTechnicien] = useState(utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}`.trim() : '');
  const [signatureTech, setSignatureTech] = useState<Blob | null>(null);
  const [responsable, setResponsable] = useState('');
  const [signatureResp, setSignatureResp] = useState<Blob | null>(null);
  const [progression, setProgression] = useState<string | null>(null);

  const apercus = useMemo(() => medias.map((f) => URL.createObjectURL(f)), [medias]);
  useEffect(() => () => apercus.forEach((u) => URL.revokeObjectURL(u)), [apercus]);

  const ajouterMedias = (liste: FileList | null) => {
    const fichiers = [...(liste ?? [])];
    const tropLourds = fichiers.filter((f) => f.size > TAILLE_MAX_MEDIA);
    if (tropLourds.length) toast.error(`${tropLourds.length} fichier(s) de plus de 50 Mo ignoré(s)`);
    setMedias((m) => [...m, ...fichiers.filter((f) => f.size <= TAILLE_MAX_MEDIA)]);
  };

  const enregistrer = useMutation({
    mutationFn: async () => {
      if (!travaux.trim()) throw new Error('Décris les travaux réalisés');
      if (!technicien.trim() || !signatureTech) throw new Error('Nom et signature du technicien obligatoires');
      if (!responsable.trim() || !signatureResp) throw new Error('Nom et signature du responsable obligatoires');

      const dossier = `${new Date().getFullYear()}/${crypto.randomUUID()}`;
      const nomPropre = (n: string) => n.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-60);
      const chemins: string[] = [];
      for (let i = 0; i < medias.length; i++) {
        const f = medias[i];
        let nom = nomPropre(f.name || (f.type.startsWith('video/') ? 'video' : 'photo.jpg'));
        // Extension vidéo garantie (lecture et affichage en vidéo ensuite)
        if (f.type.startsWith('video/') && !estCheminVideo(nom)) nom += f.type.includes('quicktime') ? '.mov' : f.type.includes('webm') ? '.webm' : '.mp4';
        const chemin = `${dossier}/${i + 1}_${nom}`;
        await envoyerFichier(BUCKET_BONS, chemin, f, (p) => setProgression(`Envoi ${i + 1}/${medias.length} · ${p} %`));
        chemins.push(chemin);
      }
      setProgression('Signatures…');
      const sigTech = `${dossier}/signature_technicien.png`;
      const sigResp = `${dossier}/signature_responsable.png`;
      for (const [chemin, blob] of [
        [sigTech, signatureTech],
        [sigResp, signatureResp],
      ] as const) {
        const { error } = await supabase.storage.from(BUCKET_BONS).upload(chemin, blob, { contentType: 'image/png' });
        if (error) throw error;
      }

      setProgression('Enregistrement…');
      const { data, error } = await supabase
        .from('bons_intervention')
        .insert({
          parc_id: parcId || null,
          activite: activite.trim() || null,
          equipement: equipement.trim() || null,
          date_intervention: new Date(date).toISOString(),
          duree_minutes: duree ? Math.max(0, Math.round(Number(duree))) : null,
          probleme: probleme.trim() || null,
          travaux: travaux.trim(),
          pieces: pieces.trim() || null,
          medias: chemins,
          technicien_nom: technicien.trim(),
          signature_technicien: sigTech,
          responsable_nom: responsable.trim(),
          signature_responsable: sigResp,
          est_formation: estFormation,
          cree_par_id: utilisateur?.id ?? null,
        })
        .select('*, parc:parcs(code, nom)')
        .single();
      if (error) throw error;
      return data as BonIntervention;
    },
    onSuccess: async (bon) => {
      toast.success(`Bon ${bon.numero ?? ''} enregistré`);
      qc.invalidateQueries({ queryKey: ['bons-intervention'] });
      onFini();
      try {
        await exportBonPDF(bon);
      } catch {
        // le PDF reste téléchargeable depuis la liste
      }
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => setProgression(null),
  });

  return (
    <div className="bg-bg-card rounded-xl border border-nikito-cyan/30 p-4 mb-5 grid gap-3 max-w-[720px]">
      <div className="text-[15px] font-semibold">Nouveau bon d'intervention</div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <select value={parcId} onChange={(e) => setParcId(e.target.value)} className={champ}>
          <option value="">Parc…</option>
          {((parcs ?? []) as Array<{ id: string; code: string; nom: string }>).map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.nom}
            </option>
          ))}
        </select>
        {/* Liste déroulante (les suggestions libres ne s'affichent pas sur toutes les tablettes) */}
        {activiteLibre ? (
          <div className="flex gap-2">
            <input value={activite} onChange={(e) => setActivite(e.target.value)} placeholder="Activité" autoFocus className={champ} />
            <button type="button" onClick={() => (setActiviteLibre(false), setActivite(''))} className="text-dim text-[12px] px-2 min-h-[44px]">
              Liste
            </button>
          </div>
        ) : (
          <select
            value={activite}
            onChange={(e) => (e.target.value === AUTRE ? (setActiviteLibre(true), setActivite('')) : setActivite(e.target.value))}
            className={champ}
          >
            <option value="">Activité…</option>
            {listeActivites.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value={AUTRE}>Autre (saisir)…</option>
          </select>
        )}
        <input value={equipement} onChange={(e) => setEquipement(e.target.value)} placeholder="Équipement / pièce concernée" className={champ} />
        <div className="grid grid-cols-[1fr_110px] gap-2.5">
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={champ} aria-label="Date de l'intervention" />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={duree}
            onChange={(e) => setDuree(e.target.value)}
            placeholder="Durée (min)"
            className={champ}
          />
        </div>
      </div>

      <textarea value={probleme} onChange={(e) => setProbleme(e.target.value)} rows={2} placeholder="Problème constaté" className={cn(champ, 'resize-none')} />
      <textarea
        value={travaux}
        onChange={(e) => setTravaux(e.target.value)}
        rows={4}
        placeholder="Travaux réalisés (obligatoire)"
        className={cn(champ, 'resize-none')}
      />
      <textarea value={pieces} onChange={(e) => setPieces(e.target.value)} rows={2} placeholder="Pièces utilisées (facultatif)" className={cn(champ, 'resize-none')} />

      {/* Photos et vidéos (facultatif) */}
      <div className="grid gap-2">
        <div className="text-[12px] text-dim">Photos / vidéos (facultatif)</div>
        <div className="flex flex-wrap gap-2">
          <label className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px] flex items-center cursor-pointer">
            📷 Photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (ajouterMedias(e.target.files), (e.target.value = ''))} />
          </label>
          <label className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px] flex items-center cursor-pointer">
            🎥 Vidéo
            <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => (ajouterMedias(e.target.files), (e.target.value = ''))} />
          </label>
          <label className="bg-bg-deep border border-white/[0.08] text-dim px-4 rounded-[10px] text-[13px] min-h-[44px] flex items-center cursor-pointer">
            🖼️ Galerie
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => (ajouterMedias(e.target.files), (e.target.value = ''))} />
          </label>
        </div>
        {medias.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {medias.map((f, i) => (
              <div key={apercus[i]} className="relative">
                {f.type.startsWith('video/') ? (
                  <video src={apercus[i]} muted playsInline className="w-full aspect-square object-cover rounded-lg bg-black" />
                ) : (
                  <img src={apercus[i]} alt="" className="w-full aspect-square object-cover rounded-lg bg-bg-deep" />
                )}
                <button
                  type="button"
                  onClick={() => setMedias((m) => m.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white text-[14px]"
                  aria-label="Retirer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signatures */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <input value={technicien} onChange={(e) => setTechnicien(e.target.value)} placeholder="Nom du technicien" className={champ} />
          <ZoneSignature libelle="Signature du technicien" onChange={setSignatureTech} />
        </div>
        <div className="grid gap-2">
          <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nom du responsable" className={champ} />
          <ZoneSignature libelle="Signature du responsable" onChange={setSignatureResp} />
        </div>
      </div>

      {progression && <div className="text-[12px] text-dim">{progression} — garde la page ouverte</div>}
      <div className="flex gap-2 justify-end">
        <button onClick={onFini} disabled={enregistrer.isPending} className="text-dim text-[13px] px-3 min-h-[44px]">
          Annuler
        </button>
        <button
          onClick={() => enregistrer.mutate()}
          disabled={enregistrer.isPending}
          className={cn('bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px]', enregistrer.isPending && 'opacity-40')}
        >
          {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer et signer'}
        </button>
      </div>
    </div>
  );
}
