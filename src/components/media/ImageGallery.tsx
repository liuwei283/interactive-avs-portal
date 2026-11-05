import type { Asset } from '../../lib/types';
import { ImageView } from './ImageView';

export interface GalleryItem {
  asset: Asset;
  label?: string;
  caption?: string;
}

export function ImageGallery({ items }: { items: GalleryItem[] }) {
  const cols = items.length === 1 ? '' : items.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 gap-4 ${cols}`}>
      {items.map((it, i) => (
        <ImageView key={it.asset.id + i} asset={it.asset} label={it.label} caption={it.caption} />
      ))}
    </div>
  );
}
