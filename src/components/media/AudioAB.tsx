import { useEffect, useRef, useState } from 'react';
import type { Asset } from '../../lib/types';
import { MediaError, MediaLoading } from './MediaFrame';
import { useAssetUrls } from './useAssetUrls';

export interface AudioSample {
  asset: Asset;
  /** Required, explicit condition label, e.g. "Ours", "Baseline: MMAudio", "Ground truth". */
  label: string;
  caption?: string;
}

/**
 * A/B(/C…) audio comparison. Switching keeps the playback position so the
 * same moment can be compared across conditions. Keys 1–9 select a sample
 * and Space toggles playback while the component has focus.
 */
export function AudioAB({ samples, title, caption }: { samples: AudioSample[]; title?: string; caption?: string }) {
  const { urls, loading, failed } = useAssetUrls(samples.map((s) => s.asset));
  const refs = useRef<(HTMLAudioElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => () => refs.current.forEach((a) => a?.pause()), []);

  const select = (i: number) => {
    if (i === active || i >= samples.length) return;
    const from = refs.current[active];
    const to = refs.current[i];
    const t = from?.currentTime ?? 0;
    const wasPlaying = from ? !from.paused : false;
    from?.pause();
    if (to) {
      try {
        to.currentTime = Math.min(t, Number.isFinite(to.duration) ? to.duration : t);
      } catch {
        /* metadata not ready */
      }
      if (wasPlaying) void to.play();
    }
    setActive(i);
  };

  const toggle = () => {
    const a = refs.current[active];
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const seek = (value: number) => {
    const a = refs.current[active];
    if (a) a.currentTime = value;
    setTime(value);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
      tabIndex={0}
      role="group"
      aria-label={title ? `Audio comparison: ${title}` : 'Audio comparison'}
      onKeyDown={(e) => {
        if (/^[1-9]$/.test(e.key)) select(Number(e.key) - 1);
        if (e.key === ' ' && e.target === e.currentTarget) {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">{title || 'Audio comparison'}</div>
        <div className="text-xs text-slate-500">Switch with 1–{samples.length}; position is kept. Headphones recommended.</div>
      </div>
      {loading ? (
        <MediaLoading height="h-20" />
      ) : failed ? (
        <MediaError message="One or more audio files could not be loaded." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Condition">
            {samples.map((s, i) => (
              <button
                key={s.asset.id + i}
                type="button"
                role="radio"
                aria-checked={i === active}
                onClick={() => select(i)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  i === active ? 'border-accent-700 bg-accent-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="mr-1.5 font-mono text-xs opacity-70">{i + 1}</span>
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="btn-primary btn-sm w-16" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
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
              aria-label="Playback position"
            />
            <span className="w-24 text-right font-mono text-xs text-slate-500">
              {fmt(time)} / {fmt(duration)}
            </span>
          </div>
          {samples.map((s, i) => (
            <audio
              key={s.asset.id + i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              src={urls[i] ?? undefined}
              preload="auto"
              onPlay={() => i === active && setPlaying(true)}
              onPause={() => i === active && setPlaying(false)}
              onEnded={() => i === active && setPlaying(false)}
              onTimeUpdate={(e) => i === active && setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => i === active && setDuration(e.currentTarget.duration)}
              onDurationChange={(e) => i === active && setDuration(e.currentTarget.duration)}
            />
          ))}
          <div className="mt-3 text-sm text-slate-600">
            <span className="font-medium">Now playing:</span> {samples[active]?.label}
            {samples[active]?.caption ? <span className="text-slate-500"> — {samples[active].caption}</span> : null}
          </div>
        </>
      )}
      {caption && <p className="mt-2 text-sm text-slate-500">{caption}</p>}
    </div>
  );
}
