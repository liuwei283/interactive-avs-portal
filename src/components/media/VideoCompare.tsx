import { useRef, useState } from 'react';
import type { Asset } from '../../lib/types';
import { MediaError, MediaLoading } from './MediaFrame';
import { useAssetUrls } from './useAssetUrls';

export interface VideoSample {
  asset: Asset;
  label: string;
  caption?: string;
}

/**
 * Side-by-side videos with synchronized play / pause / seek. Only one
 * video's audio is audible at a time ("Listen to"), which is what matters
 * when comparing generated soundtracks for the same visual input.
 */
export function VideoCompare({ samples, title, caption }: { samples: VideoSample[]; title?: string; caption?: string }) {
  const { urls, loading, failed } = useAssetUrls(samples.map((s) => s.asset));
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const [audible, setAudible] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const all = () => refs.current.filter(Boolean) as HTMLVideoElement[];

  const toggle = async () => {
    const vids = all();
    if (playing) {
      vids.forEach((v) => v.pause());
      setPlaying(false);
    } else {
      const t = vids[0]?.currentTime ?? 0;
      vids.forEach((v) => (v.currentTime = t));
      await Promise.allSettled(vids.map((v) => v.play()));
      setPlaying(true);
    }
  };

  const seek = (t: number) => {
    all().forEach((v) => (v.currentTime = t));
    setTime(t);
  };

  const cols = samples.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">{title || 'Side-by-side comparison'}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600" role="radiogroup" aria-label="Audio source">
          <span>Listen to:</span>
          {samples.map((s, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={audible === i}
              onClick={() => setAudible(i)}
              className={`rounded border px-2 py-0.5 ${audible === i ? 'border-accent-700 bg-accent-700 text-white' : 'border-slate-300 bg-white'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <MediaLoading height="h-56" />
      ) : failed ? (
        <MediaError message="One or more videos could not be loaded." />
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-3 ${cols}`}>
            {samples.map((s, i) => (
              <figure key={s.asset.id + i} className="min-w-0">
                <div className={`mb-1 text-xs font-semibold tracking-wide uppercase ${audible === i ? 'text-accent-700' : 'text-slate-600'}`}>
                  {s.label}
                  {audible === i ? ' · audible' : ''}
                </div>
                <video
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  src={urls[i] ?? undefined}
                  muted={audible !== i}
                  playsInline
                  preload="metadata"
                  className="w-full rounded-md bg-black"
                  aria-label={s.label}
                  onTimeUpdate={(e) => i === 0 && setTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => i === 0 && setDuration(e.currentTarget.duration)}
                  onEnded={() => i === 0 && setPlaying(false)}
                />
                {s.caption && <figcaption className="mt-1 text-xs text-slate-500">{s.caption}</figcaption>}
              </figure>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="btn-primary btn-sm w-16" onClick={() => void toggle()}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={time}
              onChange={(e) => seek(Number(e.target.value))}
              className="flex-1 accent-accent-700"
              aria-label="Playback position (all videos)"
            />
          </div>
        </>
      )}
      {caption && <p className="mt-2 text-sm text-slate-500">{caption}</p>}
    </div>
  );
}
