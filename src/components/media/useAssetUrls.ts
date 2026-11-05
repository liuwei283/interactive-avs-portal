import { useQueries } from '@tanstack/react-query';
import { qk } from '../../lib/api';
import { config } from '../../lib/config';
import { signedUrl } from '../../lib/storage';
import type { Asset } from '../../lib/types';

/** Signed URLs for several assets; returns null entries while loading/failed. */
export function useAssetUrls(assets: (Asset | null | undefined)[]) {
  const results = useQueries({
    queries: assets.map((a) => ({
      queryKey: qk.signed(a?.storage_path ?? ''),
      enabled: !!a,
      staleTime: (config.signedUrlSeconds - 300) * 1000,
      gcTime: (config.signedUrlSeconds - 300) * 1000,
      queryFn: () => signedUrl(a!.storage_path),
    })),
  });
  return {
    urls: results.map((r) => r.data ?? null),
    loading: results.some((r) => r.isLoading),
    failed: results.some((r) => r.error),
  };
}
