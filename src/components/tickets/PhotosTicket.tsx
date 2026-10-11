import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import { useToast } from '@/components/ui/ToastProvider';
import { PhotoCapture } from '@/components/shared/PhotoCapture';

/**
 * Photos du problème (prises au signalement, stockées dans alba-incidents)
 * affichées sur la fiche du ticket, avec agrandissement, et ajout d'une
 * photo supplémentaire.
 */
export function PhotosTicket({
  incidentId,
  chemins,
  dossier,
  modifiable,
}: {
  incidentId: string;
  chemins: string[];
  /** Préfixe de stockage des photos ajoutées (ex. FRA/BT-2026-00012) */
  dossier: string;
  modifiable: boolean;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: urls } = useSignedUrls(chemins, 'alba-incidents');
  const [zoom, setZoom] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);

  const enregistrer = async (chemin: string) => {
    const { error } = await supabase.rpc('ajouter_photo_ticket', { p_incident_id: incidentId, p_path: chemin });
    if (error) {
      toast.error(`Photo non ajoutée au ticket : ${error.message}`);
      return;
    }
    toast.success('Photo ajoutée au ticket');
    setAjout(false);
    qc.invalidateQueries({ queryKey: ['incidents'] });
  };

  return (
    <div className="bg-bg-card rounded-xl p-3.5 px-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[13px] font-semibold">
          Photo{chemins.length > 1 ? 's' : ''} du problème
          {chemins.length > 0 && <span className="text-dim font-normal"> · {chemins.length}</span>}
        </div>
        {modifiable && !ajout && (
          <button onClick={() => setAjout(true)} className="text-nikito-cyan text-[12px] min-h-[36px]">
            + Ajouter une photo
          </button>
        )}
      </div>

      {chemins.length === 0 && !ajout && <div className="text-[12px] text-dim">Aucune photo sur ce ticket.</div>}

      {chemins.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {chemins.map((c) => {
            const url = urls?.[c];
            return url ? (
              <button key={c} onClick={() => setZoom(url)} className="block rounded-lg overflow-hidden bg-bg-deep aspect-[4/3]">
                <img src={url} alt="Photo du problème" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ) : (
              <div key={c} className="rounded-lg bg-bg-deep aspect-[4/3] animate-pulse" />
            );
          })}
        </div>
      )}

      {ajout && (
        <div className="mt-3">
          <PhotoCapture bucketName="alba-incidents" storagePath={`${dossier}/ajout`} onPhotoUploaded={enregistrer} label="Nouvelle photo" />
          <button onClick={() => setAjout(false)} className="text-dim text-[12px] mt-2 min-h-[36px]">
            Annuler
          </button>
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="Photo du problème en grand" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}
