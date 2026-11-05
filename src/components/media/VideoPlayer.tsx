import type { Asset } from '../../lib/types';
import { MediaError, MediaFrame, MediaLoading } from './MediaFrame';
import { useAssetUrl } from './useAssetUrl';

export function VideoPlayer({ asset, label, caption }: { asset: Asset; label?: string; caption?: string }) {
  const url = useAssetUrl(asset);
  return (
    <MediaFrame label={label} caption={caption || asset.description || undefined}>
      {url.isLoading ? (
        <MediaLoading height="h-56" />
      ) : url.error || !url.data ? (
        <MediaError />
      ) : (
        <video
          controls
          preload="metadata"
          playsInline
          className="w-full rounded-md bg-black"
          aria-label={label || asset.title || asset.filename}
        >
          <source src={url.data} type={asset.mime_type} />
          Your browser cannot play this video. <a href={url.data}>Download {asset.filename}</a>.
        </video>
      )}
    </MediaFrame>
  );
}
