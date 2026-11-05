import type { ExperimentMetric } from '../../lib/types';

/**
 * One small horizontal bar chart per metric (one axis, one measure each).
 * Single hue for evaluated conditions; baselines in neutral gray and also
 * labeled "baseline" in text, so identity never relies on color alone.
 * The MetricTable next to it is the accessible table view.
 */
export function MetricBars({ metrics }: { metrics: ExperimentMetric[] }) {
  const groups = new Map<string, ExperimentMetric[]>();
  for (const m of metrics) {
    if (m.value === null || !Number.isFinite(m.value)) continue;
    const key = `${m.metric_name}${m.split ? ` · ${m.split}` : ''}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const charts = [...groups.entries()].filter(([, ms]) => ms.length >= 2);
  if (!charts.length) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {charts.map(([name, ms]) => {
        const max = Math.max(...ms.map((m) => Math.abs(m.value as number)), 1e-12);
        const dir = ms[0].higher_is_better;
        return (
          <figure key={name} className="rounded-md border border-slate-200 p-3">
            <figcaption className="mb-2 text-xs font-semibold text-slate-700">
              {name}
              {ms[0].unit ? ` (${ms[0].unit})` : ''}
              <span className="ml-1 font-normal text-slate-500">
                {dir === true ? '· higher is better' : dir === false ? '· lower is better' : ''}
              </span>
            </figcaption>
            <div className="space-y-1.5">
              {ms.map((m) => {
                const pct = (Math.abs(m.value as number) / max) * 100;
                return (
                  <div key={m.id} className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs" title={`${m.condition_label}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`}>
                    <span className="truncate text-slate-600">
                      {m.condition_label || '(unlabeled)'}
                      {m.is_baseline ? ' (baseline)' : ''}
                    </span>
                    <span className="h-3 rounded-r bg-slate-100">
                      <span
                        className={`block h-3 rounded-r-[4px] ${m.is_baseline ? 'bg-slate-400' : 'bg-accent-600'} group-hover:opacity-80`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </span>
                    <span className="font-mono text-slate-800 tabular-nums">{Number((m.value as number).toPrecision(4))}</span>
                  </div>
                );
              })}
            </div>
          </figure>
        );
      })}
    </div>
  );
}
