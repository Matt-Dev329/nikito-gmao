import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import { useToast } from '@/components/ui/ToastProvider';
import { voitTableauDeBord } from '@/lib/acces';
import { getImageDimensions, processImage } from '@/lib/uploadPhotoControle';
import { AnnotateurPhoto, PhotoAvecAnnotations } from './PhotoAnnotee';
import { partagerPhotoAnnotee, type Annotation, type PhotoNote } from './annotations';

const BUCKET = 'alba-perso';

interface Note {
  id: string;
  titre: string;
  contenu: string | null;
  photos: PhotoNote[];
  epinglee: boolean;
  cree_le: string;
  modifie_le: string;
}

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';
const dateFr = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function useNotes() {
  return useQuery({
    queryKey: ['notes-perso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes_perso')
        .select('id, titre, contenu, photos, epinglee, cree_le, modifie_le')
        .eq('actif', true)
        .order('modifie_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });
}

/** Bloc-notes personnel : notes, mesures et photos annotées — réservé à Ryad. */
export function PageBlocNotes() {
  const { utilisateur } = useAuth();
  if (utilisateur && !voitTableauDeBord(utilisateur)) return <Navigate to="/gmao/operations" replace />;
  return <ContenuBlocNotes />;
}

function ContenuBlocNotes() {
  const { data: notes, isLoading, isError, error } = useNotes();
  // null : liste ; 'nouvelle' : note pas encore enregistrée ; sinon id de la note ouverte
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (notes ?? [])
      .filter(
        (n) =>
          !q ||
          [n.titre, n.contenu, ...n.photos.flatMap((p) => [p.legende, ...p.annotations.map((a) => a.texte)])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => Number(b.epinglee) - Number(a.epinglee) || b.modifie_le.localeCompare(a.modifie_le));
  }, [notes, recherche]);

  if (ouverte) {
    const note = ouverte === 'nouvelle' ? null : (notes ?? []).find((n) => n.id === ouverte) ?? null;
    return <EditeurNote key={ouverte} note={note} onFermer={() => setOuverte(null)} />;
  }

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Bloc-notes</h1>
          <p className="text-[13px] text-dim mt-1">Tes notes, mesures et photos annotées — visibles par toi seul</p>
        </div>
        <button
          onClick={() => setOuverte('nouvelle')}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
        >
          + Nouvelle note
        </button>
      </div>

      <input
        type="text"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Rechercher (texte, mesure, légende…)"
        className="w-full mb-4 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : filtrees.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">
          {recherche ? 'Aucune note ne correspond.' : 'Aucune note pour l’instant. Commence par « + Nouvelle note ».'}
        </div>
      ) : (
        <ListeNotes notes={filtrees} onOuvrir={setOuverte} />
      )}
    </div>
  );
}

function ListeNotes({ notes, onOuvrir }: { notes: Note[]; onOuvrir: (id: string) => void }) {
  // Première photo de chaque note en vignette
  const { data: urls } = useSignedUrls(
    notes.map((n) => n.photos[0]?.chemin),
    BUCKET
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((n) => {
        const photo = n.photos[0];
        return (
          <button
            key={n.id}
            onClick={() => onOuvrir(n.id)}
            className="text-left bg-bg-card rounded-xl border border-white/[0.06] hover:border-nikito-cyan/40 p-4 flex flex-col gap-2 transition-colors"
          >
            <div className="flex items-start gap-2">
              <div className="text-[15px] font-semibold leading-tight flex-1">{n.titre.trim() || 'Sans titre'}</div>
              {n.epinglee && <span className="text-[12px]" aria-label="Épinglée">📌</span>}
            </div>
            {n.contenu && <div className="text-[13px] text-dim line-clamp-3 whitespace-pre-wrap">{n.contenu}</div>}
            {photo && (
              <div className="max-h-40 overflow-hidden rounded-lg">
                <PhotoAvecAnnotations url={urls?.[photo.chemin]} photo={photo} classeImage="max-h-40" />
              </div>
            )}
            <div className="text-[11px] text-faint flex gap-3 mt-auto">
              <span>{dateFr(n.modifie_le)}</span>
              {n.photos.length > 0 && (
                <span>
                  📷 {n.photos.length} photo{n.photos.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

type EtatEnregistrement = 'enregistre' | 'en_attente' | 'enregistrement' | 'erreur';

function EditeurNote({ note, onFermer }: { note: Note | null; onFermer: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const [titre, setTitre] = useState(note?.titre ?? '');
  const [contenu, setContenu] = useState(note?.contenu ?? '');
  const [photos, setPhotos] = useState<PhotoNote[]>(note?.photos ?? []);
  const [epinglee, setEpinglee] = useState(note?.epinglee ?? false);
  const [etat, setEtat] = useState<EtatEnregistrement>('enregistre');
  const [envoi, setEnvoi] = useState(0);
  const [annotee, setAnnotee] = useState<number | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const idRef = useRef<string | null>(note?.id ?? null);
  const premierRendu = useRef(true);
  const photoRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);

  const { data: urls } = useSignedUrls(
    photos.map((p) => p.chemin),
    BUCKET
  );

  // Enregistrements à la file : la note n'est créée qu'une fois, même si l'on tape vite
  const fileRef = useRef<Promise<void>>(Promise.resolve());
  const enregistrer = (valeurs: { titre: string; contenu: string; photos: PhotoNote[]; epinglee: boolean }) => {
    const suite = fileRef.current.catch(() => undefined).then(() => enregistrerMaintenant(valeurs));
    fileRef.current = suite;
    return suite;
  };
  const enregistrerMaintenant = async (valeurs: { titre: string; contenu: string; photos: PhotoNote[]; epinglee: boolean }) => {
    const ligne = { titre: valeurs.titre.trim(), contenu: valeurs.contenu.trim() || null, photos: valeurs.photos, epinglee: valeurs.epinglee };
    if (idRef.current) {
      const { error } = await supabase.from('notes_perso').update(ligne).eq('id', idRef.current);
      if (error) throw error;
    } else {
      // Rien à garder : pas de note vide
      if (!ligne.titre && !ligne.contenu && ligne.photos.length === 0) return;
      const { data, error } = await supabase.from('notes_perso').insert(ligne).select('id').single();
      if (error) throw error;
      idRef.current = data.id;
    }
  };

  // Enregistrement automatique, une seconde après la dernière modification ;
  // en quittant la note, ce qui reste à enregistrer part tout de suite.
  const aEnregistrer = useRef<Parameters<typeof enregistrer>[0] | null>(null);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    aEnregistrer.current = { titre, contenu, photos, epinglee };
    setEtat('en_attente');
    const t = setTimeout(async () => {
      const valeurs = aEnregistrer.current;
      if (!valeurs) return;
      aEnregistrer.current = null;
      setEtat('enregistrement');
      try {
        await enregistrer(valeurs);
        setEtat('enregistre');
        qc.invalidateQueries({ queryKey: ['notes-perso'] });
      } catch (e) {
        aEnregistrer.current = valeurs;
        setEtat('erreur');
        toast.error(`Note non enregistrée : ${(e as Error).message}`);
      }
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titre, contenu, photos, epinglee]);
  useEffect(
    () => () => {
      const valeurs = aEnregistrer.current;
      if (!valeurs) return;
      enregistrer(valeurs)
        .then(() => qc.invalidateQueries({ queryKey: ['notes-perso'] }))
        .catch((e) => toast.error(`Note non enregistrée : ${(e as Error).message}`));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!fichiers?.length || !utilisateur) return;
    const liste = Array.from(fichiers);
    setEnvoi((n) => n + liste.length);
    for (const f of liste) {
      try {
        const blob = await processImage(f, { maxDimension: 2400, maxSizeMB: 3, withWatermark: false });
        const { width, height } = await getImageDimensions(blob);
        const chemin = `${utilisateur.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(chemin, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        setPhotos((p) => [...p, { chemin, largeur: width, hauteur: height, legende: null, annotations: [] }]);
      } catch (e) {
        toast.error(`Photo non ajoutée : ${(e as Error).message}`);
      } finally {
        setEnvoi((n) => n - 1);
      }
    }
  };

  const retirerPhoto = (i: number) => setPhotos((p) => p.filter((_, j) => j !== i));
  const majPhoto = (i: number, annotations: Annotation[], legende: string) =>
    setPhotos((p) => p.map((ph, j) => (j === i ? { ...ph, annotations, legende: legende || null } : ph)));

  const partager = async (i: number) => {
    const url = urls?.[photos[i].chemin];
    if (!url) return;
    try {
      const r = await partagerPhotoAnnotee(url, photos[i], photos[i].legende || titre || 'photo annotée');
      if (r === 'telechargee') toast.success('Photo annotée téléchargée');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const supprimer = useMutation({
    mutationFn: async () => {
      if (!idRef.current) return;
      const { error } = await supabase.from('notes_perso').update({ actif: false }).eq('id', idRef.current);
      if (error) throw error;
    },
    onSuccess: () => {
      aEnregistrer.current = null;
      toast.success('Note supprimée');
      qc.invalidateQueries({ queryKey: ['notes-perso'] });
      onFermer();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const libelleEtat: Record<EtatEnregistrement, string> = {
    enregistre: idRef.current ? 'Enregistré ✓' : '',
    en_attente: 'Modifié…',
    enregistrement: 'Enregistrement…',
    erreur: 'Non enregistré',
  };

  return (
    <div className="p-4 md:p-6 md:px-7 max-w-[900px]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={onFermer} className="text-nikito-cyan text-[13px] font-semibold min-h-[44px]">
          ← Mes notes
        </button>
        <div className="flex items-center gap-3">
          <span className={cn('text-[12px]', etat === 'erreur' ? 'text-red' : 'text-faint')}>{libelleEtat[etat]}</span>
          <button
            onClick={() => setEpinglee((v) => !v)}
            className={cn('text-[12px] px-3 rounded-lg border min-h-[36px]', epinglee ? 'border-amber/50 text-amber' : 'border-white/10 text-dim')}
          >
            📌 {epinglee ? 'Épinglée' : 'Épingler'}
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          maxLength={160}
          placeholder="Titre (ex. Mesures filet zone trampoline SGB)"
          className={cn(champ, 'text-[16px] font-semibold')}
          autoFocus={!note}
        />
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          rows={8}
          placeholder="Tes notes, mesures, références…"
          className={cn(champ, 'resize-y leading-relaxed')}
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => photoRef.current?.click()}
            className="bg-nikito-cyan/12 border border-nikito-cyan/45 text-nikito-cyan px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
          >
            📷 Prendre une photo
          </button>
          <button
            onClick={() => galerieRef.current?.click()}
            className="border border-white/10 text-dim px-4 rounded-[10px] text-[13px] min-h-[44px]"
          >
            🖼 Depuis la galerie
          </button>
          {envoi > 0 && <span className="self-center text-[12px] text-nikito-cyan animate-pulse">Envoi de {envoi} photo{envoi > 1 ? 's' : ''}…</span>}
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => (ajouterPhotos(e.target.files), (e.target.value = ''))}
          />
          <input
            ref={galerieRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => (ajouterPhotos(e.target.files), (e.target.value = ''))}
          />
        </div>

        {photos.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((p, i) => (
              <div key={p.chemin} className="bg-bg-card rounded-xl border border-white/[0.06] p-2 flex flex-col gap-2">
                <button onClick={() => urls?.[p.chemin] && setAnnotee(i)} className="self-center" aria-label="Annoter la photo">
                  <PhotoAvecAnnotations url={urls?.[p.chemin]} photo={p} classeImage="max-h-72" />
                </button>
                {p.legende && <div className="text-[12px] text-dim px-1">{p.legende}</div>}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setAnnotee(i)}
                    disabled={!urls?.[p.chemin]}
                    className="bg-nikito-cyan/12 border border-nikito-cyan/45 text-nikito-cyan px-3 rounded-lg text-[12px] font-semibold min-h-[36px] disabled:opacity-40"
                  >
                    ✏️ Annoter / mesurer
                  </button>
                  <button
                    onClick={() => partager(i)}
                    disabled={!urls?.[p.chemin]}
                    className="border border-white/10 text-dim px-3 rounded-lg text-[12px] min-h-[36px] disabled:opacity-40"
                  >
                    ⤴ Partager
                  </button>
                  <button onClick={() => retirerPhoto(i)} className="ml-auto text-dim text-[12px] px-2 min-h-[36px]">
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {idRef.current && (
          <div className="flex justify-end pt-2">
            {confirmer ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setConfirmer(false)} className="text-dim text-[13px] min-h-[44px]">
                  Garder
                </button>
                <button onClick={() => supprimer.mutate()} className="text-red text-[13px] font-semibold min-h-[44px]">
                  Confirmer la suppression
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmer(true)} className="text-dim text-[13px] min-h-[44px]">
                Supprimer la note
              </button>
            )}
          </div>
        )}
      </div>

      {annotee !== null && photos[annotee] && urls?.[photos[annotee].chemin] && (
        <AnnotateurPhoto
          url={urls[photos[annotee].chemin]}
          photo={photos[annotee]}
          onFermer={() => setAnnotee(null)}
          onEnregistrer={(annotations, legende) => {
            majPhoto(annotee, annotations, legende);
            setAnnotee(null);
          }}
        />
      )}
    </div>
  );
}
