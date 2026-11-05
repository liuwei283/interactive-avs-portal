import { useState } from 'react';
import type { Asset } from '../../lib/types';
import { MediaError, MediaLoading } from './MediaFrame';
import { useAssetUrls } from './useAssetUrls';

/** Before/after slider for two aligned images (e.g. spectrograms, feature maps). */
export function ImageCompare({
  left, right, leftLabel, rightLabel, caption,
}: { left: Asset; right: Asset; leftLabel: string; rightLabel: string; caption?: string }) {
  const { urls, loading, failed } = useAssetUrls([left, right]);
  const [pos, setPos] = useState(50);
  return (
    <figure className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-2 flex justify-between text-xs font-semibold tracking-wide text-slate-600 uppercase">
        <span>◀ {leftLabel}</span>
        <span>{rightLabel} ▶</span>
      </div>
      {loading ? (
        <MediaLoading height="h-64" />
      ) : failed ? (
        <MediaError />
      ) : (
        <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white select-none">
          <img src={urls[1] ?? undefined} alt={rightLabel} className="block w-full" />
          <img
            src={urls[0] ?? undefined}
            alt={leftLabel}
            className="absolute inset-0 block h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
        </div>
      )}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="mt-2 w-full accent-accent-700"
        aria-label={`Reveal ${leftLabel} versus ${rightLabel}`}
      />
      {caption && <figcaption className="mt-1 text-sm text-slate-500">{caption}</figcaption>}
    </figure>
  );
}
