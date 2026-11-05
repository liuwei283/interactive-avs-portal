import { Link } from 'react-router-dom';
import { formatDate, formatWeekRange } from '../../lib/dates';
import { componentStatusLabel, documentCategoryLabel, experimentStatusLabel } from '../../lib/labels';
import type { DocumentRow, Experiment, ModelComponent, WeeklyUpdate } from '../../lib/types';
import { StatusBadge, Tag } from '../ui';

export function firstLine(md: string, max = 220): string {
  const text = md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`$|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function WeekCard({ week, experimentsCount }: { week: WeeklyUpdate; experimentsCount?: number }) {
  return (
    <Link to={`/progress/${week.week_start}`} className="card block p-4 transition-colors hover:border-accent-200 hover:bg-accent-50/30">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-900">Week of {formatDate(week.week_start)}</span>
        <StatusBadge status={week.status} />
        {experimentsCount ? <Tag>{experimentsCount} experiment{experimentsCount > 1 ? 's' : ''}</Tag> : null}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        {formatWeekRange(week.week_start)}
        {week.meeting_date ? ` · meeting ${formatDate(week.meeting_date)}` : ''}
      </div>
      {week.title && <div className="mt-2 text-sm font-medium text-slate-800">{week.title}</div>}
      {week.research_focus && <div className="mt-1 text-sm text-slate-600"><span className="text-slate-500">Focus:</span> {week.research_focus}</div>}
      {week.summary_md && <p className="mt-1 text-sm text-slate-500">{firstLine(week.summary_md)}</p>}
    </Link>
  );
}

export function ExperimentTable({ experiments, components, showComponent = true }: { experiments: Experiment[]; components?: ModelComponent[]; showComponent?: boolean }) {
  const comp = (id: string | null) => components?.find((c) => c.id === id);
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-600">
          <tr>
            <th className="px-3 py-2 font-semibold">ID</th>
            <th className="px-3 py-2 font-semibold">Experiment</th>
            {showComponent && <th className="px-3 py-2 font-semibold">Component</th>}
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {experiments.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                <Link to={`/experiments/${encodeURIComponent(e.code)}`} className="text-accent-700 hover:underline">{e.code}</Link>
              </td>
              <td className="px-3 py-2">
                <Link to={`/experiments/${encodeURIComponent(e.code)}`} className="font-medium text-slate-800 hover:underline">{e.name}</Link>
                {!e.published && <span className="ml-2"><StatusBadge status="draft" /></span>}
                {e.research_question && <div className="text-xs text-slate-500">{firstLine(e.research_question, 140)}</div>}
              </td>
              {showComponent && (
                <td className="px-3 py-2 text-xs">
                  {comp(e.model_component_id) ? (
                    <Link to={`/models/${comp(e.model_component_id)!.slug}`} className="text-slate-600 hover:underline">{comp(e.model_component_id)!.title}</Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              )}
              <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-600">{formatDate(e.experiment_date)}</td>
              <td className="px-3 py-2"><StatusBadge status={e.status} label={experimentStatusLabel[e.status]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentListItem({ doc }: { doc: DocumentRow }) {
  return (
    <Link to={`/documents/${doc.slug}`} className="flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-slate-50">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-800">{doc.title}</div>
        <div className="text-xs text-slate-500">
          {documentCategoryLabel[doc.category]} · {doc.version}
          {doc.document_date ? ` · ${formatDate(doc.document_date)}` : ''}
        </div>
      </div>
      {!doc.published && <StatusBadge status="draft" />}
    </Link>
  );
}

export function ComponentCard({ c, experimentCount }: { c: ModelComponent; experimentCount: number }) {
  return (
    <Link to={`/models/${c.slug}`} className="card flex flex-col p-4 transition-colors hover:border-accent-200 hover:bg-accent-50/30">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-slate-900">{c.title}</span>
        <StatusBadge status={c.status} label={componentStatusLabel[c.status]} />
      </div>
      {c.summary && <p className="mt-1.5 text-sm text-slate-600">{c.summary}</p>}
      <div className="mt-auto pt-3 text-xs text-slate-500">
        {experimentCount ? `${experimentCount} experiment record${experimentCount > 1 ? 's' : ''}` : 'No experiment records yet'}
      </div>
    </Link>
  );
}
