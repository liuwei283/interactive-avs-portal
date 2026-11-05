import type { Asset, ContentAssetLinkWithAsset } from '../../lib/types';
import { AssetView } from './AssetView';
import { AudioAB } from './AudioAB';
import { ImageCompare } from './ImageCompare';
import { ImageGallery } from './ImageGallery';
import { VideoCompare } from './VideoCompare';

type WithAsset = ContentAssetLinkWithAsset & { asset: Asset };

const isImage = (a: Asset) => a.kind === 'image' || a.kind === 'svg';

/**
 * Lay out attachments:
 *  - links sharing a `group_key` become a comparison (audio A/B, synced
 *    side-by-side video, or image slider for exactly two images);
 *  - ungrouped images become a gallery; other files render individually.
 */
export function AttachmentGroups({ links, roles }: { links: ContentAssetLinkWithAsset[]; roles?: string[] }) {
  const usable = links.filter((l): l is WithAsset => !!l.asset && (!roles || roles.includes(l.role)));
  if (!usable.length) return null;

  const groups = new Map<string, WithAsset[]>();
  const singles: WithAsset[] = [];
  for (const l of usable) {
    if (l.group_key) groups.set(l.group_key, [...(groups.get(l.group_key) ?? []), l]);
    else singles.push(l);
  }

  const label = (l: WithAsset) => l.label || l.asset.title || l.asset.filename;
  const images = singles.filter((l) => isImage(l.asset));
  const others = singles.filter((l) => !isImage(l.asset));

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([key, items]) => {
        const caption = items.find((i) => i.caption)?.caption;
        if (items.length >= 2 && items.every((i) => i.asset.kind === 'audio')) {
          return <AudioAB key={key} title={key} caption={caption} samples={items.map((i) => ({ asset: i.asset, label: label(i), caption: i.asset.description }))} />;
        }
        if (items.length >= 2 && items.every((i) => i.asset.kind === 'video')) {
          return <VideoCompare key={key} title={key} caption={caption} samples={items.map((i) => ({ asset: i.asset, label: label(i), caption: i.asset.description }))} />;
        }
        if (items.length === 2 && items.every((i) => isImage(i.asset))) {
          return <ImageCompare key={key} left={items[0].asset} right={items[1].asset} leftLabel={label(items[0])} rightLabel={label(items[1])} caption={caption || key} />;
        }
        return (
          <div key={key} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">{key}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((i) => (
                <AssetView key={i.id} asset={i.asset} label={label(i)} caption={i.caption} compactPdf />
              ))}
            </div>
          </div>
        );
      })}
      {images.length > 0 && <ImageGallery items={images.map((i) => ({ asset: i.asset, label: i.label || undefined, caption: i.caption || undefined }))} />}
      {others.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {others.map((i) => (
            <div key={i.id} className={i.asset.kind === 'pdf' || i.asset.kind === 'video' ? 'md:col-span-2' : ''}>
              <AssetView asset={i.asset} label={i.label || undefined} caption={i.caption || undefined} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
