import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useCatalogueCommandes } from '@/hooks/queries/useCommandes';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import type { AlbaBucket } from '@/lib/uploadPhotoControle';
import { envoyerDocument, recollerDocument } from '@/lib/envoiGrosFichier';
import { enregistrerBlob, nomDepuisChemin, telechargerUrl } from '@/lib/telecharger';
import { ROLES_PRESTATAIRES } from '@/lib/acces';

export type TypeDocument = 'plan' | 'manuel' | 'prestataire';

export const ROLES_DOCUMENTATION = ['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'];
const ROLES_EDITION = ['direction', 'chef_maintenance', 'directeur_parc', 'admin_it'];


const BUCKET: AlbaBucket = 'alba-techniques';
const PLAN_GENERAL = 'Plan général du parc';
const TAILLE_MAX = 500 * 1024 * 1024;

/** Domaines courants des prestataires extérieurs (saisie libre possible) */
const DOMAINES_PRESTATAIRES = [
  'Extincteurs',
  'Électricité',
  'Alarme incendie / SSI',
  'Désenfumage',
  'Portes coupe-feu',
  'Éclairage de sécurité',
  'Ascenseur / monte-charge',
  'Chauffage / climatisation (CVC)',
  'Gaz',
  'Plomberie',
  'Trampolines / structures',
  'Aires de jeux',
  'Dératisation / désinsectisation',
  'Nettoyage',
  'Bureau de contrôle',
];

interface DocumentTechnique {
  id: string;
  type: TypeDocument;
  parc_id: string | null;
  activite: string | null;
  titre: string;
  description: string | null;
  chemin: string;
  mime: string | null;
  taille: number | null;
  /** Nombre de parties si le fichier a été découpé (gros fichiers) */
  parties: number | null;
  /** Rapports prestataires : société, date d'intervention, prochaine visite */
  prestataire?: string | null;
  date_document?: string | null;
  prochaine_echeance?: string | null;
  cree_le: string;
  parc: { code: string; nom: string } | null;
}

const TEXTES: Record<TypeDocument, { titre: string; sousTitre: string; vide: string; ajouter: string }> = {
  plan: {
    titre: 'Plans',
    sousTitre: 'Plans des parcs, des trampolines et des activités, rangés par parc',
    vide: 'Aucun plan pour l’instant.',
    ajouter: '+ Ajouter un plan',
  },
  manuel: {
    titre: 'Manuels',
    sousTitre: 'Manuels techniques de nos activités, rangés par activité',
    vide: 'Aucun manuel pour l’instant.',
    ajouter: '+ Ajouter un manuel',
  },
  prestataire: {
    titre: 'Rapports prestataires',
    sousTitre: 'Comptes rendus des prestataires extérieurs (extincteurs, électricité…), rangés par domaine',
    vide: 'Aucun rapport de prestataire pour l’instant.',
    ajouter: '+ Ajouter un rapport',
  },
};

const COLONNES = 'id, type, parc_id, activite, titre, description, chemin, mime, taille, parties, cree_le, parc:parcs(code, nom)';

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

function useDocuments(type: TypeDocument) {
  return useQuery({
    queryKey: ['documents-techniques', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents_techniques')
        .select(type === 'prestataire' ? `${COLONNES}, prestataire, date_document, prochaine_echeance` : COLONNES)
        .eq('type', type)
        .eq('actif', true)
        .order(type === 'prestataire' ? 'date_document' : 'titre', { ascending: type !== 'prestataire' });
      if (error) throw error;
      return (data ?? []) as unknown as DocumentTechnique[];
    },
  });
}

/** Plans (par parc) ou manuels (par activité) : consultation et ajout de documents PDF / images. */
export function PageDocumentsTechniques({ type }: { type: TypeDocument }) {
  const { utilisateur } = useAuth();
  const roles = type === 'prestataire' ? ROLES_PRESTATAIRES : ROLES_DOCUMENTATION;
  if (utilisateur && !roles.includes(utilisateur.role_code)) return <Navigate to="/" replace />;
  return <ContenuDocuments key={type} type={type} />;
}

function ContenuDocuments({ type }: { type: TypeDocument }) {
  const { utilisateur } = useAuth();
  const peutEditer = (type === 'prestataire' ? ROLES_PRESTATAIRES : ROLES_EDITION).includes(utilisateur?.role_code ?? '');
  const t = TEXTES[type];
  const { data: documents, isLoading, isError, error } = useDocuments(type);
  const [filtre, setFiltre] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [ajout, setAjout] = useState(false);

  // Plans rangés par parc, manuels par activité
  const groupeDe = (d: DocumentTechnique) =>
    type === 'plan'
      ? d.parc
        ? `${d.parc.code} · ${d.parc.nom}`
        : 'Tous les parcs'
      : d.activite || (type === 'prestataire' ? 'À classer (analyse en cours)' : 'Autres');

  const categoriesExistantes = useMemo(
    () => [...new Set((documents ?? []).map((d) => (d.activite ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')),
    [documents]
  );

  const groupesDispo = useMemo(() => {
    const m = new Map<string, number>();
    (documents ?? []).forEach((d) => m.set(groupeDe(d), (m.get(groupeDe(d)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, type]);
  const filtreActif = filtre && groupesDispo.some(([g]) => g === filtre) ? filtre : null;

  const groupes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const m = new Map<string, DocumentTechnique[]>();
    (documents ?? [])
      .filter((d) => !filtreActif || groupeDe(d) === filtreActif)
      .filter((d) => !q || [d.titre, d.description, d.activite, d.parc?.nom, d.prestataire].filter(Boolean).join(' ').toLowerCase().includes(q))
      .forEach((d) => m.set(groupeDe(d), [...(m.get(groupeDe(d)) ?? []), d]));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, filtreActif, recherche, type]);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">{t.titre}</h1>
          <p className="text-[13px] text-dim mt-1">{t.sousTitre}</p>
        </div>
        {peutEditer && !ajout && (
          <button
            onClick={() => setAjout(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
          >
            {t.ajouter}
          </button>
        )}
      </div>

      {ajout && <FormulaireAjout type={type} onFini={() => setAjout(false)} />}

      <div className="flex flex-col gap-3 mb-4">
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher…"
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
        />
        {groupesDispo.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={!filtreActif} onClick={() => setFiltre(null)}>
              Tous <span className="opacity-60">· {(documents ?? []).length}</span>
            </Pill>
            {groupesDispo.map(([g, n]) => (
              <Pill key={g} variant="cyan" active={filtreActif === g} onClick={() => setFiltre(g)}>
                {g} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-28 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : groupes.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">{t.vide}</div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupes.map(([g, docs]) => (
            <section key={g}>
              <h2 className="text-[13px] text-dim uppercase tracking-wider mb-2">
                {g} <span className="text-faint">· {docs.length}</span>
              </h2>
              <GrilleDocuments documents={docs} peutEditer={peutEditer} type={type} categories={categoriesExistantes} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function GrilleDocuments({
  documents,
  peutEditer,
  type,
  categories,
}: {
  documents: DocumentTechnique[];
  peutEditer: boolean;
  type: TypeDocument;
  categories: string[];
}) {
  const { data: urls } = useSignedUrls(
    documents.filter((d) => !d.parties).map((d) => d.chemin),
    BUCKET
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((d) => (
        <CarteDocument key={d.id} doc={d} url={urls?.[d.chemin]} peutEditer={peutEditer} type={type} categories={categories} />
      ))}
    </div>
  );
}

function CarteDocument({
  doc,
  url,
  peutEditer,
  type,
  categories,
}: {
  doc: DocumentTechnique;
  url?: string;
  peutEditer: boolean;
  type: TypeDocument;
  categories: string[];
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmer, setConfirmer] = useState(false);
  const [chargement, setChargement] = useState<number | null>(null);
  const estImage = (doc.mime ?? '').startsWith('image/');

  // Gros fichier découpé en parties : on les télécharge et on les recolle
  const ouvrirDecoupe = async (e: React.MouseEvent) => {
    if (!doc.parties) return;
    e.preventDefault();
    if (chargement !== null) return;
    // Fenêtre ouverte tout de suite (sinon bloquée après l'attente)
    const fenetre = window.open('', '_blank');
    setChargement(0);
    try {
      const blob = await recollerDocument(BUCKET, doc.chemin, doc.parties, doc.mime, setChargement);
      const lien = URL.createObjectURL(blob);
      if (fenetre) {
        fenetre.location.href = lien;
      } else {
        const a = document.createElement('a');
        a.href = lien;
        a.download = doc.titre;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(lien), 10 * 60 * 1000);
    } catch (err) {
      fenetre?.close();
      toast.error((err as Error).message);
    } finally {
      setChargement(null);
    }
  };
  const lienOuvrir = doc.parties ? '#' : url;

  const [telechargement, setTelechargement] = useState(false);
  const telecharger = async () => {
    // Nom lisible : titre du document + extension d'origine
    const extension = (doc.chemin.match(/\.[a-z0-9]+$/i)?.[0] ?? '').toLowerCase();
    const nom = `${doc.titre.normalize('NFD').replace(/[^\w.-]+/g, '_')}${extension}` || nomDepuisChemin(doc.chemin);
    setTelechargement(true);
    try {
      if (doc.parties) {
        enregistrerBlob(await recollerDocument(BUCKET, doc.chemin, doc.parties, doc.mime), nom);
      } else if (url) {
        await telechargerUrl(url, nom);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTelechargement(false);
    }
  };

  // Rapports prestataires : changer la catégorie proposée par l'analyse
  const [reclasser, setReclasser] = useState(false);
  const [nouvelleCategorie, setNouvelleCategorie] = useState(doc.activite ?? '');
  const enregistrerCategorie = async () => {
    const valeur = nouvelleCategorie.trim();
    const { error } = await supabase.from('documents_techniques').update({ activite: valeur || null }).eq('id', doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReclasser(false);
    toast.success(valeur ? `Rangé dans « ${valeur} »` : 'Catégorie retirée');
    qc.invalidateQueries({ queryKey: ['documents-techniques', type] });
    qc.invalidateQueries({ queryKey: ['analyses-prestataires'] });
  };

  const retirer = async () => {
    const { error } = await supabase.from('documents_techniques').update({ actif: false }).eq('id', doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info(`« ${doc.titre} » retiré`);
    qc.invalidateQueries({ queryKey: ['documents-techniques', type] });
  };

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06] overflow-hidden flex flex-col">
      <a href={lienOuvrir} onClick={ouvrirDecoupe} target="_blank" rel="noreferrer" className={cn('block', !lienOuvrir && 'pointer-events-none')}>
        {estImage && url && !doc.parties ? (
          <img src={url} alt="" loading="lazy" className="w-full h-36 object-cover bg-bg-deep" />
        ) : (
          <div className="w-full h-36 bg-bg-deep flex flex-col items-center justify-center gap-1 text-dim">
            <span className="text-4xl">{estImage ? '🖼️' : '📄'}</span>
            <span className="text-[11px] uppercase tracking-wider">{estImage ? 'Image' : 'PDF'}</span>
          </div>
        )}
      </a>
      <div className="p-3.5 flex-1 flex flex-col">
        <div className="text-[14px] font-semibold leading-tight">{doc.titre}</div>
        <div className="text-[11px] text-dim mt-0.5">
          {(type === 'prestataire'
            ? [
                doc.prestataire,
                doc.parc?.code,
                doc.date_document ? `le ${new Date(doc.date_document).toLocaleDateString('fr-FR')}` : null,
              ]
            : [
                type === 'plan' ? doc.activite : doc.parc?.code,
                new Date(doc.cree_le).toLocaleDateString('fr-FR'),
                doc.taille ? `${(doc.taille / 1024 / 1024).toFixed(1)} Mo` : null,
              ]
          )
            .filter(Boolean)
            .join(' · ')}
        </div>
        {type === 'prestataire' && doc.prochaine_echeance && <BadgeEcheance date={doc.prochaine_echeance} />}
        {type === 'prestataire' && peutEditer && (
          reclasser ? (
            <div className="mt-2 flex gap-1.5">
              <input
                value={nouvelleCategorie}
                onChange={(e) => setNouvelleCategorie(e.target.value)}
                list={`categories-${doc.id}`}
                autoFocus
                className="flex-1 min-w-0 bg-bg-deep border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-text outline-none focus:border-nikito-cyan"
              />
              <datalist id={`categories-${doc.id}`}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <button onClick={enregistrerCategorie} className="text-nikito-cyan text-[12px] font-semibold px-1.5">
                OK
              </button>
            </div>
          ) : (
            <button onClick={() => setReclasser(true)} className="mt-1.5 self-start text-[11px] text-dim underline-offset-2 hover:underline">
              Changer de catégorie
            </button>
          )
        )}
        {doc.description && <div className="text-[12px] text-faint mt-1 line-clamp-2">{doc.description}</div>}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <a
            href={lienOuvrir}
            onClick={ouvrirDecoupe}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'bg-nikito-cyan/12 border border-nikito-cyan/45 text-nikito-cyan px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px] flex items-center',
              (!lienOuvrir || chargement !== null) && 'opacity-40 pointer-events-none'
            )}
          >
            {chargement !== null ? `Chargement ${chargement} %` : 'Ouvrir'}
          </a>
          <button
            onClick={telecharger}
            disabled={telechargement || (!doc.parties && !url)}
            className={cn(
              'bg-bg-deep border border-white/[0.08] text-nikito-cyan px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px]',
              (telechargement || (!doc.parties && !url)) && 'opacity-40'
            )}
          >
            {telechargement ? '…' : '⬇ Télécharger'}
          </button>
          {peutEditer &&
            (confirmer ? (
              <button onClick={retirer} className="text-red text-[12px] font-semibold min-h-[36px]">
                Confirmer le retrait
              </button>
            ) : (
              <button onClick={() => setConfirmer(true)} className="text-dim text-[12px] min-h-[36px]">
                Retirer
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function FormulaireAjout({ type, onFini }: { type: TypeDocument; onFini: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const { data: parcs } = useParcs();
  const { data: catalogue } = useCatalogueCommandes();
  const [titre, setTitre] = useState('');
  const [parcId, setParcId] = useState(type === 'prestataire' && utilisateur?.parc_ids?.length === 1 ? utilisateur.parc_ids[0] : '');
  const [activite, setActivite] = useState(type === 'plan' ? PLAN_GENERAL : '');
  const [prestataire, setPrestataire] = useState('');
  const [dateDocument, setDateDocument] = useState(() => new Date().toISOString().slice(0, 10));
  const [echeance, setEcheance] = useState('');
  const [description, setDescription] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [progression, setProgression] = useState<number | null>(null);

  const suggestions = useMemo(() => {
    const noms = (catalogue?.activites ?? []).map((a) => a.nom);
    if (type === 'prestataire') return DOMAINES_PRESTATAIRES;
    return type === 'plan' ? [PLAN_GENERAL, ...noms] : noms;
  }, [catalogue, type]);

  const envoyer = useMutation({
    mutationFn: async () => {
      if (!fichier) throw new Error('Choisis un fichier (PDF ou image)');
      // Rapports prestataires : domaine et prestataire facultatifs, l'analyse
      // automatique range le rapport dans une catégorie (existante ou créée)
      const titreFinal =
        titre.trim() ||
        (type === 'prestataire'
          ? [activite.trim(), prestataire.trim()].filter(Boolean).join(' — ') || fichier.name.replace(/\.[^.]+$/, '')
          : '');
      if (!titreFinal) throw new Error('Donne un titre au document');
      if (type === 'manuel' && !activite.trim()) throw new Error('Indique l’activité du manuel');
      if (fichier.size > TAILLE_MAX) throw new Error('Fichier trop lourd (500 Mo maximum)');
      const parc = (parcs as Array<{ id: string; code: string }> | undefined)?.find((p) => p.id === parcId);
      const nomPropre = fichier.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
      const chemin = `${type}/${parc?.code ?? 'commun'}/${Date.now()}_${nomPropre}`;
      setProgression(0);
      const parties = await envoyerDocument(BUCKET, chemin, fichier, setProgression);
      const { data: cree, error } = await supabase.from('documents_techniques').insert({
        type,
        parc_id: parcId || null,
        activite: activite.trim() || null,
        titre: titreFinal,
        description: description.trim() || null,
        ...(type === 'prestataire'
          ? { prestataire: prestataire.trim(), date_document: dateDocument || null, prochaine_echeance: echeance || null }
          : {}),
        chemin,
        mime: fichier.type || null,
        taille: fichier.size,
        parties,
        cree_par_id: utilisateur?.id ?? null,
      }).select('id').single();
      if (error) throw error;
      // Rapport prestataire : analyse automatique (points conformes / non conformes, renouvellement)
      if (type === 'prestataire' && cree?.id) {
        // Une fois l'analyse finie, le rapport est rangé dans sa catégorie
        void supabase.functions
          .invoke('analyser-rapport-prestataire', { body: { document_id: cree.id } })
          .finally(() => {
            qc.invalidateQueries({ queryKey: ['documents-techniques', 'prestataire'] });
            qc.invalidateQueries({ queryKey: ['analyses-prestataires'] });
          });
      }
    },
    onSuccess: () => {
      toast.success(type === 'prestataire' ? 'Rapport ajouté — analyse en cours (onglet « Analyses prestataires »)' : 'Document ajouté');
      qc.invalidateQueries({ queryKey: ['documents-techniques', type] });
      onFini();
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => setProgression(null),
  });

  return (
    <div className="bg-bg-card rounded-xl border border-nikito-cyan/30 p-4 mb-4 grid gap-2.5 max-w-[640px]">
      <div className="text-[14px] font-semibold">
        {type === 'plan' ? 'Nouveau plan' : type === 'manuel' ? 'Nouveau manuel' : 'Nouveau rapport de prestataire'}
      </div>
      {type === 'prestataire' && (
        <div className="grid sm:grid-cols-2 gap-2.5">
          <input value={prestataire} onChange={(e) => setPrestataire(e.target.value)} placeholder="Prestataire (facultatif, lu sur le rapport)" className={champ} />
          <label className="grid gap-1">
            <span className="text-[11px] text-dim">Date d’intervention</span>
            <input type="date" value={dateDocument} onChange={(e) => setDateDocument(e.target.value)} className={champ} />
          </label>
        </div>
      )}
      <input
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        placeholder={type === 'prestataire' ? 'Titre (facultatif, ex. Vérification annuelle)' : 'Titre (ex. Plan trampoline zone A)'}
        className={champ}
      />
      <div className="grid sm:grid-cols-2 gap-2.5">
        <select value={parcId} onChange={(e) => setParcId(e.target.value)} className={champ}>
          <option value="">{type === 'manuel' ? 'Tous les parcs (manuel commun)' : 'Tous les parcs'}</option>
          {((parcs ?? []) as Array<{ id: string; code: string; nom: string }>).map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.nom}
            </option>
          ))}
        </select>
        <input
          value={activite}
          onChange={(e) => setActivite(e.target.value)}
          list={`activites-${type}`}
          placeholder={
            type === 'plan' ? 'Type de plan (ex. Trampoline)' : type === 'prestataire' ? 'Catégorie (automatique si vide)' : 'Activité (ex. Bowling)'
          }
          className={champ}
        />
        <datalist id={`activites-${type}`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      {type === 'prestataire' && (
        <label className="grid gap-1 max-w-[280px]">
          <span className="text-[11px] text-dim">Prochaine visite (facultatif)</span>
          <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={champ} />
        </label>
      )}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Description (facultatif)"
        className={cn(champ, 'resize-none')}
      />
      <input
        type="file"
        accept="application/pdf,image/*"
        onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
        className="text-[13px] text-dim file:mr-3 file:rounded-lg file:border-0 file:bg-nikito-cyan/15 file:text-nikito-cyan file:px-3 file:py-2"
      />
      <div className="text-[11px] text-faint">
        PDF ou image, jusqu’à 500 Mo{fichier ? ` · ${(fichier.size / 1024 / 1024).toFixed(1)} Mo sélectionnés` : ''}
      </div>
      {progression !== null && (
        <div>
          <div className="h-2 rounded-full bg-bg-deep overflow-hidden">
            <div className="h-full bg-nikito-cyan transition-all" style={{ width: `${progression}%` }} />
          </div>
          <div className="text-[11px] text-dim mt-1">Envoi en cours… {progression} % — garde la page ouverte</div>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onFini} className="text-dim text-[13px] px-3 min-h-[44px]">
          Annuler
        </button>
        <button
          onClick={() => envoyer.mutate()}
          disabled={envoyer.isPending}
          className={cn('bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px]', envoyer.isPending && 'opacity-40')}
        >
          {envoyer.isPending ? (progression !== null ? `Envoi ${progression} %` : 'Envoi…') : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

export function PagePlans() {
  return <PageDocumentsTechniques type="plan" />;
}

export function PageManuels() {
  return <PageDocumentsTechniques type="manuel" />;
}

export function PageRapportsPrestataires() {
  return <PageDocumentsTechniques type="prestataire" />;
}

/** Prochaine visite du prestataire : rouge si dépassée, orange sous 30 jours. */
function BadgeEcheance({ date }: { date: string }) {
  const jours = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  const libelle = new Date(date).toLocaleDateString('fr-FR');
  return (
    <div
      className={cn(
        'mt-1.5 self-start text-[11px] px-2 py-0.5 rounded',
        jours < 0 ? 'bg-red/15 text-red' : jours <= 30 ? 'bg-amber/15 text-amber' : 'bg-green/15 text-green'
      )}
    >
      {jours < 0 ? `Visite dépassée (${libelle})` : `Prochaine visite : ${libelle}`}
    </div>
  );
}
