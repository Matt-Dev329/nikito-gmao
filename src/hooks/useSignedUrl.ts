import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AlbaBucket } from '@/lib/uploadPhotoControle'

export interface UseSignedUrlOptions {
  expiresIn?: number
  download?: boolean
  enabled?: boolean
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
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn, download ? { download: true } : undefined)
      if (error) {
        console.warn(`Signed URL impossible pour ${bucket}/${path}:`, error.message)
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
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(cleanPaths, expiresIn)
      if (error) {
        console.warn(`Signed URLs en lot impossible pour ${bucket}:`, error.message)
        return {}
      }
      const map: Record<string, string> = {}
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl
      }
      return map
    },
    enabled: options.enabled !== false && cleanPaths.length > 0,
    staleTime: Math.max((expiresIn - 600) * 1000, 60_000),
    gcTime: expiresIn * 1000,
    refetchOnWindowFocus: false,
  })
}
