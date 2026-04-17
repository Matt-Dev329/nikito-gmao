import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface PhotoCaptureProps {
  bucketName: string;
  storagePath: string;
  onPhotoUploaded: (url: string) => void;
  required?: boolean;
  label?: string;
  existingUrl?: string;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_W = 1200;
      let w = img.width;
      let h = img.height;
      if (w > MAX_W) {
        h = Math.round((h * MAX_W) / w);
        w = MAX_W;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context null'));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'));
          resolve(blob);
        },
        'image/jpeg',
        0.8,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

export function PhotoCapture({
  bucketName,
  storagePath,
  onPhotoUploaded,
  required,
  label,
  existingUrl,
}: PhotoCaptureProps) {
  const [state, setState] = useState<UploadState>(existingUrl ? 'done' : 'idle');
  const [photoUrl, setPhotoUrl] = useState<string | null>(existingUrl ?? null);
  const [errMsg, setErrMsg] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setState('uploading');
      setErrMsg('');
      try {
        const compressed = await compressImage(file);
        const fileName = `${storagePath}_${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(fileName, compressed, { contentType: 'image/jpeg' });
        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        setPhotoUrl(urlData.publicUrl);
        setState('done');
        onPhotoUploaded(urlData.publicUrl);
      } catch (err) {
        setState('error');
        setErrMsg(err instanceof Error ? err.message : 'Erreur upload');
      }
    },
    [bucketName, storagePath, onPhotoUploaded],
  );

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) upload(file);
      e.target.value = '';
    },
    [upload],
  );

  const reprendre = () => {
    setPhotoUrl(null);
    setState('idle');
  };

  if (state === 'done' && photoUrl) {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <div className="text-[11px] text-dim uppercase tracking-wider">
            {label}
            {required && <span className="text-red ml-1">*</span>}
          </div>
        )}
        <div className="flex items-center gap-3">
          <img
            src={photoUrl}
            alt="Photo"
            className="w-[120px] h-[120px] rounded-xl object-cover border border-white/[0.08]"
          />
          <button
            onClick={reprendre}
            className="bg-bg-deep border border-white/[0.08] text-dim px-3 py-2 rounded-lg text-[12px] min-h-[44px]"
          >
            Reprendre
          </button>
        </div>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <div className="text-[11px] text-dim uppercase tracking-wider">
            {label}
            {required && <span className="text-red ml-1">*</span>}
          </div>
        )}
        <div className="min-h-[120px] rounded-xl bg-bg-card border border-dashed border-nikito-cyan/30 flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-nikito-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-dim">Upload en cours...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="text-[11px] text-dim uppercase tracking-wider">
          {label}
          {required && <span className="text-red ml-1">*</span>}
        </div>
      )}
      <div
        className={cn(
          'min-h-[120px] rounded-xl bg-bg-card border border-dashed flex flex-col items-center justify-center gap-3 p-4',
          state === 'error' ? 'border-red/40' : 'border-white/[0.12]',
        )}
      >
        {state === 'error' && (
          <div className="text-red text-[12px] text-center mb-1">{errMsg}</div>
        )}
        <div className="flex gap-2.5">
          <button
            onClick={() => cameraRef.current?.click()}
            className="bg-gradient-cta text-text px-4 py-3 rounded-xl text-[13px] font-bold min-h-[54px] flex items-center gap-2"
          >
            <span className="text-lg">&#128247;</span>
            Prendre une photo
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="bg-bg-deep border border-white/[0.08] text-text px-4 py-3 rounded-xl text-[13px] min-h-[54px] flex items-center gap-2"
          >
            <span className="text-lg">&#128193;</span>
            Galerie
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
