import { Link } from 'react-router-dom';
import { useAttachments, useMetrics } from '../../lib/api';
import { experimentStatusLabel } from '../../lib/labels';
import { formatDate } from '../../lib/dates';
import type { Experiment, ModelComponent } from '../../lib/types';
import { MetricTable } from '../media/MetricTable';
import { AttachmentGroups } from '../media/AttachmentGroups';
import { StatusBadge } from '../ui';
import { Markdown } from './Markdown';

/** Compact, embeddable view of an experiment record (used on weekly pages). */
export function ExperimentSummary({ e, component, note }: { e: Experiment; component?: ModelComponent; note?: string }) {
  const metrics = useMetrics([e.id]);
  const att = useAttachments('experiment', e.id);
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to={`/experiments/${encodeURIComponent(e.code)}`} className="font-semibold text-slate-900 hover:text-accent-700 hover:underline">
            <span className="mr-2 font-mono text-xs text-accent-700">{e.code}</span>
            {e.name}
          </Link>
          <div className="mt-0.5 text-xs text-slate-500">
            {component && (
              <>
                <Link to={`/models/${component.slug}`} className="hover:underline">{component.title}</Link> ·{' '}
              </>
            )}
            {formatDate(e.experiment_date)}
          </div>
        </div>
        <StatusBadge status={e.status} label={experimentStatusLabel[e.status]} />
      </div>
      {note && <p className="mt-2 text-sm text-slate-700">{note}</p>}
      {e.research_question && <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-700">Question:</span> {e.research_question}</p>}
      {!!metrics.data?.length && <div className="mt-3"><MetricTable metrics={metrics.data} /></div>}
      {e.conclusions_md && <div className="mt-3"><div className="mb-1 text-xs font-semibold text-slate-600 uppercase">Conclusions</div><Markdown className="text-sm">{e.conclusions_md}</Markdown></div>}
      {!!att.data?.length && <div className="mt-4"><AttachmentGroups links={att.data} /></div>}
      <div className="mt-3 text-right">
        <Link to={`/experiments/${encodeURIComponent(e.code)}`} className="text-sm text-accent-700 hover:underline">Full experiment record →</Link>
      </div>
    </article>
  );
}
