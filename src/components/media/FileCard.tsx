import { formatBytes } from '../../lib/files';
import type { Asset } from '../../lib/types';
import { useDownloadUrl } from './useAssetUrl';

const kindIcon: Record<string, string> = {
  pdf: 'PDF', pptx: 'PPTX', data: 'DATA', image: 'IMG', svg: 'SVG', audio: 'AUDIO', video: 'VIDEO', other: 'FILE',
};

/** Download card for files the browser cannot preview (PPTX, CSV, JSON, ...). */
export function FileCard({ asset, label, caption }: { asset: Asset; label?: string; caption?: string }) {
  const dl = useDownloadUrl(asset);
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
      <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
        {kindIcon[asset.kind] ?? 'FILE'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-800">{label || asset.title || asset.filename}</div>
        <div className="truncate text-xs text-slate-500">
          {asset.filename} · {formatBytes(asset.size_bytes)}
          {asset.version > 1 ? ` · v${asset.version}` : ''}
          {caption ? ` · ${caption}` : ''}
        </div>
      </div>
      {dl.data ? (
        <a href={dl.data} className="btn-secondary btn-sm">
          Download
        </a>
      ) : (
        <span className="text-xs text-slate-400">{dl.error ? 'Unavailable' : '…'}</span>
      )}
    </div>
  );
}
