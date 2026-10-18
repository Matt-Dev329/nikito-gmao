import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import type { AlbaBucket } from '@/lib/uploadPhotoControle';
import { PhotoCapture } from '@/components/shared/PhotoCapture';

/**
 * Plusieurs photos pour un même endroit (point de contrôle, photo avant /
 * après…) : vignettes des photos déjà prises, suppression, et ajout d'une
 * photo de plus. Chaque photo garde son propre chemin de stockage.
 */
export function PhotosMultiples({
  bucketName,
  storagePath,
  chemins,
  onChange,
  label,
  required,
  modifiable = true,
  max = 10,
}: {
  bucketName: AlbaBucket;
  storagePath: string;
  chemins: string[];
  onChange: (chemins: string[]) => void;
  label?: string;
  required?: boolean;
  modifiable?: boolean;
  max?: number;
}) {
  const { data: urls } = useSignedUrls(chemins, bucketName);
  // Change à chaque photo ajoutée : remet la prise de photo à zéro pour la suivante
  const [cle, setCle] = useState(0);
  const [ajout, setAjout] = useState(false);

  const ajouter = (chemin: string) => {
    if (!chemins.includes(chemin)) onChange([...chemins, chemin]);
    setCle((c) => c + 1);
    setAjout(false);
  };

  const montrerCapture = modifiable && chemins.length < max && (chemins.length === 0 || ajout);

  return (
    <div className="flex flex-col gap-2">
      {chemins.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {chemins.map((c, i) => {
            const url = urls?.[c];
            return (
              <div key={c} className="relative aspect-square rounded-lg overflow-hidden bg-bg-deep">
                {url ? (
                  <img src={url} alt={`Photo ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-dim text-center p-1 animate-pulse">
                    Photo {i + 1}
                  </div>
                )}
                {modifiable && (
                  <button
                    type="button"
                    onClick={() => onChange(chemins.filter((x) => x !== c))}
                    aria-label={`Retirer la photo ${i + 1}`}
                    className="absolute top-1 right-1 w-8 h-8 rounded-full bg-bg-app/80 text-text text-[14px] flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {montrerCapture && (
        <div>
          <PhotoCapture
            key={cle}
            bucketName={bucketName}
            storagePath={storagePath}
            onPhotoUploaded={ajouter}
            required={required && chemins.length === 0}
            label={chemins.length === 0 ? label : 'Photo supplémentaire'}
          />
          {chemins.length > 0 && (
            <button type="button" onClick={() => setAjout(false)} className="text-dim text-[12px] mt-1 min-h-[36px]">
              Annuler
            </button>
          )}
        </div>
      )}

      {modifiable && chemins.length > 0 && !ajout && chemins.length < max && (
        <button
          type="button"
          onClick={() => setAjout(true)}
          className={cn('self-start text-nikito-cyan text-[12px] font-semibold min-h-[36px]')}
        >
          + Ajouter une photo ({chemins.length}/{max})
        </button>
      )}
    </div>
  );
}
