import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AlbaBucket } from '@/lib/uploadPhotoControle'

export interface UseSignedUrlOptions {
  expiresIn?: number
  download?: boolean
  enabled?: boolean
}

function extractStoragePath(raw: string, bucket: AlbaBucket): string {
  const publicPrefix = `/storage/v1/object/public/${bucket}/`
  const idx = raw.indexOf(publicPrefix)
  if (idx !== -1) return raw.slice(idx + publicPrefix.length)
  const signedPrefix = `/storage/v1/object/sign/${bucket}/`
  const sIdx = raw.indexOf(signedPrefix)
  if (sIdx !== -1) {
    const withoutPrefix = raw.slice(sIdx + signedPrefix.length)
    return withoutPrefix.split('?')[0]
  }
  return raw
}

export function useSignedUrl(
  path: string | null | undefined,
  bucket: AlbaBucket,
  options: UseSignedUrlOptions = {}
) {
  const expiresIn = options.expiresIn ?? 3600
  const download = options.download ?? false
  const enabled = options.enabled !== false && !!path

  return useQuery({
    queryKey: ['signed-url', bucket, path, download],
    queryFn: async () => {
      if (!path) return null
      const cleanPath = extractStoragePath(path, bucket)
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath, expiresIn, download ? { download: true } : undefined)
      if (error) {
        console.warn(`Signed URL impossible pour ${bucket}/${cleanPath}:`, error.message)
        return null
      }
      return data?.signedUrl ?? null
    },
    enabled,
    staleTime: Math.max((expiresIn - 600) * 1000, 60_000),
    gcTime: expiresIn * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useSignedUrls(
  paths: (string | null | undefined)[],
  bucket: AlbaBucket,
  options: UseSignedUrlOptions = {}
) {
  const cleanPaths = paths.filter((p): p is string => !!p)
  const expiresIn = options.expiresIn ?? 3600

  return useQuery({
    queryKey: ['signed-urls', bucket, cleanPaths],
    queryFn: async () => {
      if (cleanPaths.length === 0) return {}
      const storagePaths = cleanPaths.map((p) => extractStoragePath(p, bucket))
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(storagePaths, expiresIn)
      if (error) {
        console.warn(`Signed URLs en lot impossible pour ${bucket}:`, error.message)
        return {}
      }
      const map: Record<string, string> = {}
      for (let i = 0; i < (data ?? []).length; i++) {
        const item = data![i]
        if (item.signedUrl) map[cleanPaths[i]] = item.signedUrl
      }
      return map
    },
    enabled: options.enabled !== false && cleanPaths.length > 0,
    staleTime: Math.max((expiresIn - 600) * 1000, 60_000),
    gcTime: expiresIn * 1000,
    refetchOnWindowFocus: false,
  })
}
