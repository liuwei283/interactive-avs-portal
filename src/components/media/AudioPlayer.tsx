import type { Asset } from '../../lib/types';
import { MediaError, MediaFrame, MediaLoading } from './MediaFrame';
import { useAssetUrl } from './useAssetUrl';

export function AudioPlayer({ asset, label, caption }: { asset: Asset; label?: string; caption?: string }) {
  const url = useAssetUrl(asset);
  return (
    <MediaFrame label={label} caption={caption || asset.description || undefined}>
      {url.isLoading ? (
        <MediaLoading height="h-10" />
      ) : url.error || !url.data ? (
        <MediaError />
      ) : (
        <audio controls preload="metadata" src={url.data} className="w-full" aria-label={label || asset.title || asset.filename}>
          <a href={url.data}>Download {asset.filename}</a>
        </audio>
      )}
    </MediaFrame>
  );
}
