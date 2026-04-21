import { useState } from 'react'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import type { AlbaBucket } from '@/lib/uploadPhotoControle'

export interface PrivateImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  path: string | null | undefined
  bucket: AlbaBucket
  fallback?: React.ReactNode
  errorFallback?: React.ReactNode
  expiresIn?: number
  zoomable?: boolean
}

export function PrivateImage({
  path, bucket, fallback, errorFallback, expiresIn, zoomable = false,
  className, alt, ...imgProps
}: PrivateImageProps) {
  const { data: url, isLoading, isError } = useSignedUrl(path, bucket, { expiresIn })
  const [zoomed, setZoomed] = useState(false)

  if (isLoading) {
    return <>{fallback ?? <div className={`bg-card animate-pulse ${className ?? ''}`} aria-label="Chargement..." />}</>
  }
  if (isError || !url) {
    return <>{errorFallback ?? <div className={`bg-card flex items-center justify-center text-xs text-gray-400 ${className ?? ''}`}>Photo indisponible</div>}</>
  }

  const img = (
    <img
      src={url}
      alt={alt ?? 'Photo'}
      className={className}
      loading="lazy"
      onClick={zoomable ? () => setZoomed(true) : imgProps.onClick}
      style={{ cursor: zoomable ? 'zoom-in' : undefined, ...imgProps.style }}
      {...imgProps}
    />
  )

  if (!zoomable || !zoomed) return img

  return (
    <>
      {img}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        onClick={() => setZoomed(false)}
      >
        <img src={url} alt={alt ?? 'Photo en plein écran'} className="max-w-full max-h-full object-contain" />
      </div>
    </>
  )
}
