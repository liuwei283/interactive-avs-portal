import { useSignedUrl } from '../../lib/api';
import type { Asset } from '../../lib/types';

export function DownloadButton({ asset, label = 'Download', className = 'btn-secondary btn-sm' }: { asset: Asset | null | undefined; label?: string; className?: string }) {
  const url = useSignedUrl(asset?.storage_path, asset?.filename);
  if (!asset) return null;
  if (!url.data) return <span className={`${className} pointer-events-none opacity-50`}>{label}</span>;
  return (
    <a href={url.data} className={className}>
      {label}
    </a>
  );
}
