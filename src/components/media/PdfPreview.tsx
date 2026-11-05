import type { Asset } from '../../lib/types';
import { MediaError, MediaFrame, MediaLoading } from './MediaFrame';
import { useAssetUrl, useDownloadUrl } from './useAssetUrl';

/** Embedded PDF using the browser's built-in viewer, with open/download fallbacks. */
export function PdfPreview({ asset, label, caption, height = 'h-[75vh]' }: { asset: Asset; label?: string; caption?: string; height?: string }) {
  const url = useAssetUrl(asset);
  const dl = useDownloadUrl(asset);
  return (
    <MediaFrame label={label} caption={caption}>
      {url.isLoading ? (
        <MediaLoading height={height} />
      ) : url.error || !url.data ? (
        <MediaError />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <iframe src={url.data} title={asset.title || asset.filename} className={`w-full ${height} bg-slate-50`} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <span className="truncate">{asset.filename}</span>
            <span className="flex gap-2">
              <a className="btn-secondary btn-sm" href={url.data} target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
              {dl.data && (
                <a className="btn-secondary btn-sm" href={dl.data}>
                  Download
                </a>
              )}
            </span>
          </div>
        </div>
      )}
    </MediaFrame>
  );
}
