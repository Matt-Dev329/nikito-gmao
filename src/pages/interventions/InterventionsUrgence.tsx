import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn, estCheminVideo } from '@/lib/utils';
import { envoyerFichier } from '@/lib/envoiGrosFichier';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import { useToast } from '@/components/ui/ToastProvider';
import { ZoneSignature } from '@/components/ui/ZoneSignature';
import { ChoixTestActivite } from '@/components/tickets/ChoixTestActivite';
import { BUCKET_BONS, exportBonPDF, type BonIntervention } from './exportBonPDF';

// ============================================================
// Interventions d'urgence — registre personnel de Ryad, et de lui seul
// (même verrou que son tableau de bord : acces_tableau_de_bord en base,
// voitTableauDeBord à l'écran). Photos / vidéos dans son dossier personnel
// (bucket alba-perso, réservé à lui).
// ============================================================

const BUCKET = 'alba-perso';

interface Urgence {
  id: string;
  parc_id: string | null;
  activite: string | null;
  equipement: string | null;
  appelant: string | null;
  heure_appel: string | null;
  debut_intervention: string | null;
  fin_intervention: string | null;
  probleme: string | null;
  details: string | null;
  pieces: string | null;
  medias: string[];
  cree_le: string;
  /** Envoyée comme bon d'intervention : bon créé et date du mail */
  bon_id: string | null;
  envoye_le: string | null;
  bon?: { numero: string | null } | null;
}

interface Saisie {
  parc_id: string;
  activite: string;
  equipement: string;
  appelant: string;
  heure_appel: string;
  debut_intervention: string;
  fin_intervention: string;
  probleme: string;
  details: string;
  pieces: string;
}

const champ = 'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

/** ISO → valeur d'un champ datetime-local (heure locale) */
const versChamp = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const maintenant = () => versChamp(new Date().toISOString());
const versIso = (v: string) => (v ? new Date(v).toISOString() : null);
const dateHeure = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const heure = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }) : '—');
const duree = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  const min = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  if (min < 0) return null;
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
};
const nomPropre = (n: string) => n.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);

const vide = (): Saisie => ({
  parc_id: '',
  activite: '',
  equipement: '',
  appelant: '',
  heure_appel: maintenant(),
  debut_intervention: '',
  fin_intervention: '',
  probleme: '',
  details: '',
  pieces: '',
});
const depuis = (u: Urgence): Saisie => ({
  parc_id: u.parc_id ?? '',
  activite: u.activite ?? '',
  equipement: u.equipement ?? '',
  appelant: u.appelant ?? '',
  heure_appel: versChamp(u.heure_appel),
  debut_intervention: versChamp(u.debut_intervention),
  fin_intervention: versChamp(u.fin_intervention),
  probleme: u.probleme ?? '',
  details: u.details ?? '',
  pieces: u.pieces ?? '',
});

function useUrgences() {
  return useQuery({
    queryKey: ['interventions-urgence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interventions_urgence')
        .select('id, parc_id, activite, equipement, appelant, heure_appel, debut_intervention, fin_intervention, probleme, details, pieces, medias, cree_le, bon_id, envoye_le, bon:bons_intervention(numero)')
        .eq('actif', true)
        .order('heure_appel', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Urgence[];
    },
  });
}

/** Bouton + formulaire + liste des interventions d'urgence (à n'afficher qu'à Ryad) */
export function SectionUrgences() {
  const { data: urgences } = useUrgences();
  const [edition, setEdition] = useState<{ urgence: Urgence } | null>(null);
  // Les urgences se font désormais comme des bons d'intervention (case « urgence »).
  // Ne restent ici que les anciennes fiches pas encore envoyées comme bon.
  const aEnvoyer = (urgences ?? []).filter((u) => !u.envoye_le);
  if (!aEnvoyer.length) return null;

  return (
    <div className="mb-6 rounded-2xl border border-red/30 bg-red/[0.04] p-3 md:p-4">
      <div className="mb-3">
        <div className="text-[15px] font-semibold">🚨 Anciennes fiches d'urgence à envoyer</div>
        <div className="text-[12px] text-dim">
          Visible par toi seul · les nouvelles urgences se font avec « + Nouveau bon » → case « 🚨 Intervention d’urgence ». Envoie
          ces fiches comme bon pour les transformer en bon d’intervention.
        </div>
      </div>
      {edition && <FormulaireUrgence urgence={edition.urgence} onFini={() => setEdition(null)} />}
      <div className="grid gap-2">
        {aEnvoyer.map((u) => (
          <CarteUrgence key={u.id} urgence={u} onModifier={() => setEdition({ urgence: u })} />
        ))}
      </div>
    </div>
  );
}

function CarteUrgence({ urgence: u, onModifier }: { urgence: Urgence; onModifier: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: parcs } = useParcs();
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const { data: urls } = useSignedUrls(ouvert ? u.medias : [], BUCKET);
  const parc = ((parcs ?? []) as Array<{ id: string; code: string }>).find((p) => p.id === u.parc_id);
  const arrivee = duree(u.heure_appel, u.debut_intervention);
  const surPlace = duree(u.debut_intervention, u.fin_intervention);

  const retirer = async () => {
    if (!window.confirm('Retirer cette intervention d’urgence ?')) return;
    const { error } = await supabase.from('interventions_urgence').update({ actif: false }).eq('id', u.id);
    if (error) return toast.error(error.message);
    toast.info('Intervention retirée');
    qc.invalidateQueries({ queryKey: ['interventions-urgence'] });
  };

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06]">
      <button onClick={() => setOuvert(!ouvert)} className="w-full text-left px-4 py-3 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {u.fin_intervention ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-green/15 text-green">Terminée</span>
          ) : (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-red/15 text-red">En cours</span>
          )}
          {parc && <span className="text-nikito-cyan font-semibold">{parc.code}</span>}
          <strong>{[u.activite, u.equipement].filter(Boolean).join(' · ') || 'Urgence'}</strong>
          {u.medias.length > 0 && <span className="text-dim text-[12px]">📷 {u.medias.length}</span>}
          {u.envoye_le && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-nikito-cyan/15 text-nikito-cyan">
              ✉️ Envoyé{u.bon?.numero ? ` · ${u.bon.numero}` : ''}
            </span>
          )}
          <span className="text-dim text-[12px] ml-auto">Appel {dateHeure(u.heure_appel)}</span>
        </div>
        <div className="text-[12px] text-dim">
          Début {heure(u.debut_intervention)} · fin {heure(u.fin_intervention)}
          {arrivee ? ` · arrivée en ${arrivee}` : ''}
          {surPlace ? ` · ${surPlace} sur place` : ''}
        </div>
        {u.probleme && <div className="text-[13px] line-clamp-1">{u.probleme}</div>}
      </button>
      {ouvert && (
        <div className="px-4 pb-4 pt-3 border-t border-white/[0.06] grid gap-2 text-[13px]">
          {u.appelant && <Info k="Appel de" v={u.appelant} />}
          <Info k="Heure d'appel" v={dateHeure(u.heure_appel)} />
          <Info k="Début d'intervention" v={dateHeure(u.debut_intervention)} />
          <Info k="Fin d'intervention" v={dateHeure(u.fin_intervention)} />
          {u.probleme && <Bloc k="Problème" v={u.probleme} />}
          {u.details && <Bloc k="Détails de l'intervention" v={u.details} />}
          {u.pieces && <Bloc k="Pièces utilisées" v={u.pieces} />}
          {u.medias.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {u.medias.map((c) => {
                const url = urls?.[c];
                if (!url) return <div key={c} className="aspect-[4/3] rounded-lg bg-bg-deep animate-pulse" />;
                return estCheminVideo(c) ? (
                  <video key={c} src={url} controls playsInline preload="metadata" className="w-full aspect-[4/3] rounded-lg bg-black" />
                ) : (
                  <a key={c} href={url} target="_blank" rel="noreferrer" className="block aspect-[4/3] rounded-lg overflow-hidden bg-bg-deep">
                    <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </a>
                );
              })}
            </div>
          )}
          {u.envoye_le && (
            <div className="text-[12px] text-nikito-cyan">
              ✉️ Envoyé au parc le {dateHeure(u.envoye_le)}
              {u.bon?.numero ? ` · bon ${u.bon.numero} (liste des bons d'intervention)` : ''}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3 mt-1">
            {!u.envoye_le && (
              <button
                onClick={() => setEnvoi(true)}
                className="bg-red/15 border border-red/45 text-red px-3 rounded-lg text-[12px] font-semibold min-h-[36px]"
              >
                {u.bon_id ? '📤 Renvoyer le mail au parc' : '📤 Envoyer comme bon d’intervention'}
              </button>
            )}
            <button onClick={retirer} className="text-dim text-[12px] min-h-[36px]">
              Retirer
            </button>
            <button
              onClick={onModifier}
              className="bg-nikito-cyan/12 border border-nikito-cyan/45 text-nikito-cyan px-3 rounded-lg text-[12px] font-semibold min-h-[36px]"
            >
              ✏️ Modifier / ajouter la fin
            </button>
          </div>
        </div>
      )}
      {envoi && <ModaleEnvoiBon urgence={u} onClose={() => setEnvoi(false)} />}
    </div>
  );
}

const enBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Envoi d'une intervention d'urgence comme bon d'intervention normal : bon créé
 * (numéro BI-…, signatures, photos copiées), visible dans la liste des bons, et
 * mail avec le PDF au parc (chef d'équipe, directeurs, managers, direction).
 */
function ModaleEnvoiBon({ urgence: u, onClose }: { urgence: Urgence; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const dejaCree = !!u.bon_id;
  const [technicien, setTechnicien] = useState(utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}`.trim() : '');
  const [signatureTech, setSignatureTech] = useState<Blob | null>(null);
  const [responsable, setResponsable] = useState('');
  const [signatureResp, setSignatureResp] = useState<Blob | null>(null);
  const [testActivite, setTestActivite] = useState<boolean | null>(null);
  const [etape, setEtape] = useState<string | null>(null);

  const envoyer = async () => {
    try {
      let bon: BonIntervention;
      if (dejaCree) {
        // Bon déjà créé, seul le mail avait échoué : on le renvoie
        const { data, error } = await supabase.from('bons_intervention').select('*, parc:parcs(code, nom)').eq('id', u.bon_id!).single();
        if (error) throw error;
        bon = data as BonIntervention;
      } else {
        if (!u.parc_id) throw new Error('Indique le parc de l’intervention (Modifier) avant de l’envoyer');
        if (!u.details?.trim()) throw new Error('Décris l’intervention (Modifier → Détails) avant de l’envoyer');
        if (testActivite === null) throw new Error('Indique si le test de l’activité a été fait (oui ou non)');
        if (!technicien.trim() || !signatureTech) throw new Error('Nom et signature du technicien obligatoires');
        if (!responsable.trim() || !signatureResp) throw new Error('Nom et signature du responsable obligatoires');
        const dossier = `${new Date().getFullYear()}/${crypto.randomUUID()}`;
        // Photos / vidéos : copiées du dossier personnel vers les bons
        const medias: string[] = [];
        for (let i = 0; i < u.medias.length; i++) {
          setEtape(`Photos ${i + 1}/${u.medias.length}…`);
          const { data: fichier, error } = await supabase.storage.from(BUCKET).download(u.medias[i]);
          if (error || !fichier) throw new Error(`Photo ${i + 1} illisible : ${error?.message ?? ''}`);
          const nom = u.medias[i].split('/').pop() ?? `media_${i + 1}`;
          const chemin = `${dossier}/${i + 1}_${nom}`;
          const { error: errUp } = await supabase.storage.from(BUCKET_BONS).upload(chemin, fichier, { contentType: fichier.type || undefined });
          if (errUp) throw errUp;
          medias.push(chemin);
        }
        setEtape('Signatures…');
        const sigTech = `${dossier}/signature_technicien.png`;
        const sigResp = `${dossier}/signature_responsable.png`;
        for (const [chemin, blob] of [
          [sigTech, signatureTech],
          [sigResp, signatureResp],
        ] as const) {
          const { error } = await supabase.storage.from(BUCKET_BONS).upload(chemin, blob, { contentType: 'image/png' });
          if (error) throw error;
        }
        setEtape('Création du bon…');
        const debut = u.debut_intervention ?? u.heure_appel ?? new Date().toISOString();
        const minutes =
          u.debut_intervention && u.fin_intervention
            ? Math.max(0, Math.round((new Date(u.fin_intervention).getTime() - new Date(u.debut_intervention).getTime()) / 60000))
            : null;
        const { data, error } = await supabase
          .from('bons_intervention')
          .insert({
            parc_id: u.parc_id,
            activite: u.activite,
            equipement: u.equipement,
            date_intervention: debut,
            duree_minutes: minutes,
            probleme: u.probleme,
            travaux: u.appelant ? `Appel de : ${u.appelant}\n\n${u.details!.trim()}` : u.details!.trim(),
            est_urgence: true,
            heure_panne: u.heure_appel,
            fin_intervention: u.fin_intervention,
            test_activite: testActivite,
            pieces: u.pieces,
            medias,
            technicien_nom: technicien.trim(),
            signature_technicien: sigTech,
            responsable_nom: responsable.trim(),
            signature_responsable: sigResp,
            cree_par_id: utilisateur?.id ?? null,
          })
          .select('*, parc:parcs(code, nom)')
          .single();
        if (error) throw error;
        bon = data as BonIntervention;
        await supabase.from('interventions_urgence').update({ bon_id: bon.id }).eq('id', u.id);
      }
      setEtape('PDF et envoi du mail…');
      const pdf = await exportBonPDF(bon, { telecharger: false });
      const { data: rep, error: errMail } = await supabase.functions.invoke('envoyer-bon-intervention', {
        body: {
          bon_id: bon.id,
          pdf_base64: await enBase64(pdf),
          urgence: { heure_appel: u.heure_appel, debut_intervention: u.debut_intervention, fin_intervention: u.fin_intervention, appelant: u.appelant },
        },
      });
      if (errMail || rep?.success === false) throw new Error(`Bon ${bon.numero ?? ''} créé, mais mail non envoyé : ${rep?.error ?? errMail?.message ?? ''}`);
      await supabase.from('interventions_urgence').update({ envoye_le: new Date().toISOString() }).eq('id', u.id);
      toast.success(`Bon ${bon.numero ?? ''} envoyé au parc (${rep?.envoye ?? 0} destinataire${(rep?.envoye ?? 0) > 1 ? 's' : ''})`);
      qc.invalidateQueries({ queryKey: ['interventions-urgence'] });
      qc.invalidateQueries({ queryKey: ['bons-intervention'] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      qc.invalidateQueries({ queryKey: ['interventions-urgence'] });
    } finally {
      setEtape(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[640px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-red/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-bold">📤 Envoyer comme bon d’intervention</div>
        <div className="text-[12px] text-dim">
          Un bon d’intervention (numéro BI-…) est créé avec cette urgence, ses photos et les signatures, et un mail avec le PDF part au
          parc : directeur(s), managers, chef d’équipe et direction.
        </div>
        {dejaCree ? (
          <div className="text-[13px]">Le bon est déjà créé ; seul le mail sera renvoyé.</div>
        ) : (
          <>
            <ChoixTestActivite valeur={testActivite} onChange={setTestActivite} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <input value={technicien} onChange={(e) => setTechnicien(e.target.value)} placeholder="Nom du technicien" className={champ} />
                <ZoneSignature libelle="Signature du technicien" onChange={setSignatureTech} />
              </div>
              <div className="grid gap-2">
                <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nom du responsable" className={champ} />
                <ZoneSignature libelle="Signature du responsable" onChange={setSignatureResp} />
              </div>
            </div>
          </>
        )}
        {etape && <div className="text-[12px] text-dim">{etape} — garde la page ouverte</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={!!etape} className="text-dim text-[13px] px-3 min-h-[44px]">
            Annuler
          </button>
          <button
            onClick={envoyer}
            disabled={!!etape}
            className="bg-red/20 border border-red/50 text-red px-5 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-50"
          >
            {etape ? 'Envoi…' : dejaCree ? 'Renvoyer le mail' : 'Créer le bon et l’envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormulaireUrgence({ urgence, onFini }: { urgence: Urgence | null; onFini: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const { data: parcs } = useParcs();
  const [s, setS] = useState<Saisie>(() => (urgence ? depuis(urgence) : vide()));
  const [medias, setMedias] = useState<File[]>([]);
  const [progression, setProgression] = useState<string | null>(null);
  const maj = (k: keyof Saisie) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setS((x) => ({ ...x, [k]: e.target.value }));
  const parcsListe = useMemo(() => (parcs ?? []) as Array<{ id: string; code: string; nom: string }>, [parcs]);

  const enregistrer = async () => {
    if (!utilisateur) return;
    if (!s.heure_appel && !s.debut_intervention) return toast.error("Indique au moins l'heure d'appel ou le début d'intervention");
    if (s.debut_intervention && s.fin_intervention && new Date(s.fin_intervention) < new Date(s.debut_intervention))
      return toast.error('La fin doit être après le début de l’intervention');
    try {
      // Photos / vidéos dans le dossier personnel (bucket réservé à Ryad)
      const nouveaux: string[] = [];
      for (let i = 0; i < medias.length; i++) {
        const f = medias[i];
        const chemin = `${utilisateur.id}/urgences/${Date.now()}_${i + 1}_${nomPropre(f.name)}`;
        await envoyerFichier(BUCKET, chemin, f, (p) => setProgression(`Envoi ${i + 1}/${medias.length} · ${p} %`));
        nouveaux.push(chemin);
      }
      setProgression('Enregistrement…');
      const valeurs = {
        parc_id: s.parc_id || null,
        activite: s.activite.trim() || null,
        equipement: s.equipement.trim() || null,
        appelant: s.appelant.trim() || null,
        heure_appel: versIso(s.heure_appel),
        debut_intervention: versIso(s.debut_intervention),
        fin_intervention: versIso(s.fin_intervention),
        probleme: s.probleme.trim() || null,
        details: s.details.trim() || null,
        pieces: s.pieces.trim() || null,
        medias: [...(urgence?.medias ?? []), ...nouveaux],
      };
      const { error } = urgence
        ? await supabase.from('interventions_urgence').update(valeurs).eq('id', urgence.id)
        : await supabase.from('interventions_urgence').insert(valeurs);
      if (error) throw error;
      toast.success(urgence ? 'Intervention d’urgence mise à jour' : 'Intervention d’urgence enregistrée');
      qc.invalidateQueries({ queryKey: ['interventions-urgence'] });
      onFini();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgression(null);
    }
  };

  const Maintenant = ({ k }: { k: 'heure_appel' | 'debut_intervention' | 'fin_intervention' }) => (
    <button type="button" onClick={() => setS((x) => ({ ...x, [k]: maintenant() }))} className="text-nikito-cyan text-[11px] font-semibold">
      maintenant
    </button>
  );

  return (
    <div className="bg-bg-card rounded-xl border border-red/40 p-4 mb-3 grid gap-3">
      <div className="text-[15px] font-semibold">{urgence ? 'Modifier l’intervention d’urgence' : 'Nouvelle intervention d’urgence'}</div>
      <div className="grid sm:grid-cols-3 gap-2.5">
        <select value={s.parc_id} onChange={maj('parc_id')} className={champ}>
          <option value="">Parc…</option>
          {parcsListe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.nom}
            </option>
          ))}
        </select>
        <input value={s.activite} onChange={maj('activite')} placeholder="Activité (ex. Bowling)" className={champ} />
        <input value={s.equipement} onChange={maj('equipement')} placeholder="Équipement (ex. Piste 4)" className={champ} />
      </div>
      <input value={s.appelant} onChange={maj('appelant')} placeholder="Appel de (qui a appelé, facultatif)" className={champ} />
      <div className="grid sm:grid-cols-3 gap-2.5">
        <label className="grid gap-1">
          <span className="text-[11px] text-dim flex justify-between">
            Heure d'appel <Maintenant k="heure_appel" />
          </span>
          <input type="datetime-local" value={s.heure_appel} onChange={maj('heure_appel')} className={champ} />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] text-dim flex justify-between">
            Début d'intervention <Maintenant k="debut_intervention" />
          </span>
          <input type="datetime-local" value={s.debut_intervention} onChange={maj('debut_intervention')} className={champ} />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] text-dim flex justify-between">
            Fin d'intervention <Maintenant k="fin_intervention" />
          </span>
          <input type="datetime-local" value={s.fin_intervention} onChange={maj('fin_intervention')} className={champ} />
        </label>
      </div>
      <textarea value={s.probleme} onChange={maj('probleme')} rows={2} placeholder="Problème (ce qui a été signalé)" className={cn(champ, 'resize-none')} />
      <textarea value={s.details} onChange={maj('details')} rows={4} placeholder="Détails de l'intervention (diagnostic, ce qui a été fait, suite à donner…)" className={cn(champ, 'resize-y')} />
      <input value={s.pieces} onChange={maj('pieces')} placeholder="Pièces utilisées (facultatif)" className={champ} />
      <div className="grid gap-1">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => setMedias(Array.from(e.target.files ?? []))}
          className="text-[13px] text-dim file:mr-3 file:rounded-lg file:border-0 file:bg-nikito-cyan/15 file:text-nikito-cyan file:px-3 file:py-2"
        />
        <span className="text-[11px] text-faint">
          Photos / vidéos (plusieurs possibles){urgence?.medias.length ? ` · ${urgence.medias.length} déjà enregistrée(s), les nouvelles s'ajoutent` : ''}
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onFini} className="text-dim text-[13px] px-3 min-h-[44px]">
          Annuler
        </button>
        <button
          onClick={enregistrer}
          disabled={progression !== null}
          className="bg-red/20 border border-red/50 text-red px-5 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-50"
        >
          {progression ?? 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-dim text-[12px]">{k} : </span>
      {v}
    </div>
  );
}

function Bloc({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-dim text-[12px]">{k}</div>
      <div className="whitespace-pre-wrap">{v}</div>
    </div>
  );
}
