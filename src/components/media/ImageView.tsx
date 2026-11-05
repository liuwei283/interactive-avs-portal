import { useState } from 'react';
import type { Asset } from '../../lib/types';
import { MediaError, MediaFrame, MediaLoading } from './MediaFrame';
import { useAssetUrl } from './useAssetUrl';

/** Image / SVG / diagram with click-to-zoom. SVGs render through <img>, so embedded scripts never execute. */
export function ImageView({ asset, label, caption, zoomable = true }: { asset: Asset; label?: string; caption?: string; zoomable?: boolean }) {
  const url = useAssetUrl(asset);
  const [zoom, setZoom] = useState(false);
  const alt = caption || asset.title || asset.filename;
  return (
    <MediaFrame label={label} caption={caption || asset.description || undefined}>
      {url.isLoading ? (
        <MediaLoading height="h-48" />
      ) : url.error || !url.data ? (
        <MediaError />
      ) : (
        <>
          <button
            type="button"
            className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-slate-200 bg-white"
            onClick={() => zoomable && setZoom(true)}
            aria-label={`Enlarge ${alt}`}
          >
            <img src={url.data} alt={alt} loading="lazy" className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
          </button>
          {zoom && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-slate-900/80 p-4"
              onClick={() => setZoom(false)}
              onKeyDown={(e) => e.key === 'Escape' && setZoom(false)}
              tabIndex={-1}
            >
              <img src={url.data} alt={alt} className="max-h-full max-w-full rounded bg-white object-contain" />
            </div>
          )}
        </>
      )}
    </MediaFrame>
  );
}
