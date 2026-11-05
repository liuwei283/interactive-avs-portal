import type { ExperimentMetric } from '../../lib/types';

interface Column {
  key: string;
  name: string;
  unit: string;
  split: string;
  higherIsBetter: boolean | null;
}

function columnsOf(metrics: ExperimentMetric[]): Column[] {
  const cols = new Map<string, Column>();
  for (const m of metrics) {
    const key = `${m.metric_name}\u0000${m.split}`;
    if (!cols.has(key)) cols.set(key, { key, name: m.metric_name, unit: m.unit, split: m.split, higherIsBetter: m.higher_is_better });
  }
  return [...cols.values()];
}

function fmt(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.001 || a >= 1e6)) return v.toExponential(3);
  return Number(v.toPrecision(5)).toString();
}

/**
 * Conditions (rows) × metrics (columns). The best value per column is
 * marked only when the direction (higher/lower is better) is recorded.
 * Values are shown exactly as entered — nothing is computed or inferred.
 */
export function MetricTable({ metrics, caption }: { metrics: ExperimentMetric[]; caption?: string }) {
  if (!metrics.length) return null;
  const cols = columnsOf(metrics);
  const rows = [...new Set(metrics.map((m) => m.condition_label || '(unlabeled)'))];
  const cell = (row: string, col: Column) =>
    metrics.find((m) => (m.condition_label || '(unlabeled)') === row && `${m.metric_name}\u0000${m.split}` === col.key);
  const best = new Map<string, number>();
  for (const c of cols) {
    if (c.higherIsBetter === null) continue;
    const vals = rows.map((r) => cell(r, c)?.value).filter((v): v is number => typeof v === 'number');
    if (vals.length > 1) best.set(c.key, c.higherIsBetter ? Math.max(...vals) : Math.min(...vals));
  }
  const isBaseline = (row: string) => metrics.some((m) => (m.condition_label || '(unlabeled)') === row && m.is_baseline);

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        {caption && <caption className="caption-bottom px-3 py-2 text-left text-xs text-slate-500">{caption}</caption>}
        <thead className="bg-slate-50 text-left text-xs text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Condition</th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                {c.name}
                {c.unit ? ` (${c.unit})` : ''}
                {c.higherIsBetter === true ? ' ↑' : c.higherIsBetter === false ? ' ↓' : ''}
                {c.split && <div className="font-normal text-slate-400">{c.split}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap text-slate-800">
                {r}
                {isBaseline(r) && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 uppercase">baseline</span>}
              </th>
              {cols.map((c) => {
                const m = cell(r, c);
                const isBest = m?.value !== null && m?.value !== undefined && best.get(c.key) === m.value;
                return (
                  <td key={c.key} className={`px-3 py-2 font-mono tabular-nums ${isBest ? 'font-semibold text-slate-900' : 'text-slate-700'}`} title={m?.notes || undefined}>
                    {fmt(m?.value ?? null)}
                    {isBest && <span className="sr-only"> (best)</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {cols.some((c) => c.higherIsBetter !== null) && (
        <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">↑ higher is better · ↓ lower is better · bold = best among rows with a recorded value.</p>
      )}
    </div>
  );
}
