import { useSignedUrl } from '../../lib/api';
import type { Asset } from '../../lib/types';

export function useAssetUrl(asset: Asset | null | undefined) {
  return useSignedUrl(asset?.storage_path);
}

export function useDownloadUrl(asset: Asset | null | undefined) {
  return useSignedUrl(asset?.storage_path, asset?.filename);
}
