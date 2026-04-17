import { useState, useEffect, useCallback } from 'react';

interface PhotoLightboxProps {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex = 0, onClose }: PhotoLightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const multi = photos.length > 1;

  const prev = useCallback(() => {
    setIdx((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const next = useCallback(() => {
    setIdx((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  let touchStartX = 0;
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 60) {
      if (dx < 0) next();
      else prev();
    }
  };

  if (!photos.length) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 bg-white/10 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl z-10 backdrop-blur-sm"
      >
        &#10005;
      </button>

      {multi && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white text-[13px] px-3 py-1 rounded-full z-10">
          {idx + 1} / {photos.length}
        </div>
      )}

      {multi && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white w-10 h-10 rounded-full flex items-center justify-center text-xl z-10"
        >
          &#8249;
        </button>
      )}

      <img
        src={photos[idx]}
        alt={`Photo ${idx + 1}`}
        className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {multi && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white w-10 h-10 rounded-full flex items-center justify-center text-xl z-10"
        >
          &#8250;
        </button>
      )}
    </div>
  );
}

interface PhotoThumbProps {
  url: string;
  alt?: string;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

export function PhotoThumb({ url, alt, size = 'sm', onClick }: PhotoThumbProps) {
  const sizeClass = size === 'md' ? 'w-20 h-20' : 'w-12 h-12';
  return (
    <img
      src={url}
      alt={alt ?? 'Photo'}
      className={`${sizeClass} rounded-lg object-cover cursor-pointer border border-white/[0.08] transition-transform hover:scale-105`}
      onClick={onClick}
    />
  );
}
