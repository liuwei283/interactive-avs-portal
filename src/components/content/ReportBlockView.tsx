import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { assetIdOf, parseReportBlock, type ReportBlockType } from '../../lib/reportBlocks';
import type { Asset } from '../../lib/types';
import { AudioAB } from '../media/AudioAB';
import { VideoCompare } from '../media/VideoCompare';
import { ImageCompare } from '../media/ImageCompare';
import { ImageGallery } from '../media/ImageGallery';
import { AssetView } from '../media/AssetView';
import { MediaError, MediaLoading } from '../media/MediaFrame';

function useAssetsByIds(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['assets', 'ids', ...sorted],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('assets').select('*').in('id', sorted);
      if (error) throw new Error(error.message);
      return data as Asset[];
    },
  });
}

/** Renders a ```compare-audio / compare-video / compare-image / gallery / metrics block. */
export function ReportBlockView({ type, body }: { type: ReportBlockType; body: string }) {
  const block = parseReportBlock(type, body);
  const items = block.type === 'metrics' ? [] : block.items;
  const ids = items.map((i) => assetIdOf(i.ref)).filter((x): x is string => !!x);
  const assets = useAssetsByIds(ids);

  if (block.type === 'metrics') {
    return (
      <figure className="not-prose my-6">
        {block.title && <figcaption className="mb-2 text-sm font-semibold text-slate-800">{block.title}</figcaption>}
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>{block.header.map((h, i) => <th key={i} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {block.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-800">{c}</th>
                    ) : (
                      <td key={j} className="px-3 py-2 font-mono text-slate-700 tabular-nums">{c}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {block.caption && <p className="mt-1.5 text-sm text-slate-500">{block.caption}</p>}
      </figure>
    );
  }

  const unsynced = items.filter((i) => !assetIdOf(i.ref));
  if (unsynced.length) {
    return <MediaError message={`Not synced yet: ${unsynced.map((u) => u.ref).join(', ')}. Run npm run sync:week.`} />;
  }
  if (assets.isLoading) return <MediaLoading height="h-40" />;
  const byId = new Map((assets.data ?? []).map((a) => [a.id, a]));
  const resolved = items.map((i) => ({ ...i, asset: byId.get(assetIdOf(i.ref)!) }));
  const missing = resolved.filter((r) => !r.asset);
  if (missing.length) return <MediaError message={`File(s) not found: ${missing.map((m) => m.label || m.ref).join(', ')}`} />;
  const ok = resolved as (typeof resolved[number] & { asset: Asset })[];

  let content;
  if (block.type === 'compare-audio' && ok.length >= 2) {
    content = <AudioAB title={block.title} caption={block.caption} samples={ok.map((r) => ({ asset: r.asset, label: r.label || r.asset.title }))} />;
  } else if (block.type === 'compare-video' && ok.length >= 2) {
    content = <VideoCompare title={block.title} caption={block.caption} samples={ok.map((r) => ({ asset: r.asset, label: r.label || r.asset.title }))} />;
  } else if (block.type === 'compare-image' && ok.length === 2) {
    content = <ImageCompare left={ok[0].asset} right={ok[1].asset} leftLabel={ok[0].label} rightLabel={ok[1].label} caption={block.caption || block.title} />;
  } else if (block.type === 'gallery') {
    content = (
      <>
        {block.title && <div className="mb-2 text-sm font-semibold text-slate-800">{block.title}</div>}
        <ImageGallery items={ok.map((r) => ({ asset: r.asset, caption: r.label || undefined }))} />
        {block.caption && <p className="mt-1.5 text-sm text-slate-500">{block.caption}</p>}
      </>
    );
  } else {
    // Fallback: show each file side by side with its label.
    content = (
      <div className="rounded-lg border border-slate-200 p-4">
        {block.title && <div className="mb-3 text-sm font-semibold text-slate-800">{block.title}</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{ok.map((r, i) => <AssetView key={i} asset={r.asset} label={r.label} />)}</div>
        {block.caption && <p className="mt-2 text-sm text-slate-500">{block.caption}</p>}
      </div>
    );
  }
  return <div className="not-prose my-6">{content}</div>;
}
