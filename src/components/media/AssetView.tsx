import type { Asset } from '../../lib/types';
import { AudioPlayer } from './AudioPlayer';
import { FileCard } from './FileCard';
import { ImageView } from './ImageView';
import { PdfPreview } from './PdfPreview';
import { VideoPlayer } from './VideoPlayer';

/** Render any asset with the most appropriate viewer for its kind. */
export function AssetView({ asset, label, caption, compactPdf }: { asset: Asset; label?: string; caption?: string; compactPdf?: boolean }) {
  switch (asset.kind) {
    case 'image':
    case 'svg':
      return <ImageView asset={asset} label={label} caption={caption} />;
    case 'audio':
      return <AudioPlayer asset={asset} label={label} caption={caption} />;
    case 'video':
      return <VideoPlayer asset={asset} label={label} caption={caption} />;
    case 'pdf':
      return <PdfPreview asset={asset} label={label} caption={caption} height={compactPdf ? 'h-[480px]' : undefined} />;
    default:
      return <FileCard asset={asset} label={label} caption={caption} />;
  }
}
