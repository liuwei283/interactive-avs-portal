import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useAttachments, useAttachmentsFor, useExperiments, useMetrics, useModelComponents, useThrusts, useWeeklyComponentLinks,
  useWeeklyExperimentLinks, useWeeklyUpdates,
} from '../lib/api';
import { componentStatusLabel } from '../lib/labels';
import { formatDate } from '../lib/dates';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Markdown } from '../components/content/Markdown';
import { ExperimentTable, WeekCard } from '../components/content/Cards';
import { AttachmentGroups } from '../components/media/AttachmentGroups';
import { MetricTable } from '../components/media/MetricTable';
import { MetricBars } from '../components/media/MetricBars';
import { EditLink, EmptyState, PageHeader, QueryState, StatusBadge } from '../components/ui';
import NotFoundPage from './NotFoundPage';
import { useTitle } from '../lib/useTitle';

const TOC = [
  ['overview', 'Technical overview'],
  ['motivation', 'Research motivation'],
  ['architecture', 'Architecture'],
  ['implementation', 'Implementation notes'],
  ['training', 'Training configuration'],
  ['experiments', 'Experiment records'],
  ['quantitative', 'Quantitative results'],
  ['qualitative', 'Qualitative results & demos'],
  ['limitations', 'Known limitations'],
  ['status', 'Status & planned improvements'],
  ['weekly', 'Related weekly updates'],
] as const;

function Sec({ id, title, children, kind }: { id: string; title: string; children: ReactNode; kind?: 'plan' | 'evidence' }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="section-title">{title}</h2>
        {kind === 'plan' && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">design / plan</span>}
        {kind === 'evidence' && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">recorded evidence</span>}
      </div>
      {children}
    </section>
  );
}

function MdOr({ md, empty = 'Not documented yet.' }: { md: string; empty?: string }) {
  return md.trim() ? <Markdown>{md}</Markdown> : <p className="text-sm text-slate-400 italic">{empty}</p>;
}

export default function ModelComponentPage() {
  const { slug } = useParams();
  const components = useModelComponents();
  const thrusts = useThrusts();
  const experiments = useExperiments();
  const weeks = useWeeklyUpdates();
  const wExp = useWeeklyExperimentLinks();
  const wComp = useWeeklyComponentLinks();
  const c = components.data?.find((x) => x.slug === slug);
  const exps = (experiments.data ?? []).filter((e) => c && e.model_component_id === c.id);
  const metrics = useMetrics(exps.map((e) => e.id));
  const ownAtt = useAttachments('model_component', c?.id);
  const expAtt = useAttachmentsFor('experiment', exps.map((e) => e.id));
  useTitle(c?.title ?? 'Model component');

  if (components.isLoading) return <QueryState isLoading error={null}>{null}</QueryState>;
  if (!c) return <NotFoundPage what="Model component" />;

  const thrust = thrusts.data?.find((t) => t.id === c.thrust_id);
  const diagrams = (ownAtt.data ?? []).filter((a) => a.role === 'diagram');
  const otherOwn = (ownAtt.data ?? []).filter((a) => a.role !== 'diagram');
  const weekIds = new Set<string>([
    ...(wComp.data ?? []).filter((l) => l.model_component_id === c.id).map((l) => l.weekly_update_id),
    ...(wExp.data ?? []).filter((l) => exps.some((e) => e.id === l.experiment_id)).map((l) => l.weekly_update_id),
  ]);
  const relatedWeeks = (weeks.data ?? []).filter((w) => weekIds.has(w.id));

  return (
    <article>
      <Breadcrumbs items={[{ label: 'Models', to: '/models' }, ...(thrust ? [{ label: `Part ${thrust.numeral}`, to: `/models#${thrust.slug}` }] : []), { label: c.title }]} />
      <PageHeader
        eyebrow={thrust ? `Part ${thrust.numeral} — ${thrust.title}` : 'Model component'}
        title={c.title}
        description={c.summary}
        meta={
          <>
            <StatusBadge status={c.status} label={componentStatusLabel[c.status]} />
            <span>{exps.length} experiment record{exps.length === 1 ? '' : 's'}</span>
            <span>Last edited {formatDate(c.updated_at)}</span>
          </>
        }
        actions={
          <>
            <Link to={`/admin/experiments/new?component=${c.id}`} className="btn-secondary">New experiment</Link>
            <EditLink to={`/admin/models/${c.id}`} />
          </>
        }
      />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="On this page" className="no-print hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <div className="eyebrow mb-2">On this page</div>
          <ul className="space-y-0.5 text-sm">
            {TOC.map(([id, l]) => <li key={id}><a href={`#${id}`} className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900">{l}</a></li>)}
          </ul>
        </nav>
        <div className="min-w-0 space-y-10">
          <Sec id="overview" title="Technical overview" kind="plan"><MdOr md={c.overview_md} /></Sec>
          <Sec id="motivation" title="Research motivation" kind="plan"><MdOr md={c.motivation_md} /></Sec>
          <Sec id="architecture" title="Architecture" kind="plan">
            <div className="space-y-4">
              <MdOr md={c.architecture_md} empty={diagrams.length ? '' : 'No architecture description or diagram yet.'} />
              {diagrams.length > 0 && <AttachmentGroups links={diagrams} />}
            </div>
          </Sec>
          <Sec id="implementation" title="Implementation notes"><MdOr md={c.implementation_md} /></Sec>
          <Sec id="training" title="Training configuration"><MdOr md={c.training_config_md} /></Sec>
          <Sec id="experiments" title="Experiment records" kind="evidence">
            {exps.length ? (
              <ExperimentTable experiments={exps} showComponent={false} />
            ) : (
              <EmptyState title="No experiment records for this component" action={<Link to={`/admin/experiments/new?component=${c.id}`} className="btn-secondary btn-sm">Record an experiment</Link>} />
            )}
          </Sec>
          <Sec id="quantitative" title="Quantitative results" kind="evidence">
            {c.results_md.trim() && <Markdown className="mb-4">{c.results_md}</Markdown>}
            {metrics.data?.length ? (
              <div className="space-y-8">
                {exps.filter((e) => metrics.data!.some((m) => m.experiment_id === e.id)).map((e) => {
                  const ms = metrics.data!.filter((m) => m.experiment_id === e.id);
                  return (
                    <div key={e.id} className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-700">
                        <Link to={`/experiments/${encodeURIComponent(e.code)}`} className="hover:underline"><span className="font-mono text-accent-700">{e.code}</span> {e.name}</Link>
                        <span className="ml-2 font-normal text-slate-500">{formatDate(e.experiment_date)}{e.dataset ? ` · ${e.dataset}` : ''}</span>
                      </h3>
                      <MetricTable metrics={ms} />
                      <MetricBars metrics={ms} />
                    </div>
                  );
                })}
                <p className="text-xs text-slate-500">Metrics are shown per experiment and are not aggregated across experiments, since datasets, splits and definitions may differ.</p>
              </div>
            ) : (
              !c.results_md.trim() && <p className="text-sm text-slate-400 italic">No verified results recorded yet.</p>
            )}
          </Sec>
          <Sec id="qualitative" title="Qualitative results & demos" kind="evidence">
            {otherOwn.length || expAtt.data?.length ? (
              <div className="space-y-8">
                {otherOwn.length > 0 && <AttachmentGroups links={otherOwn} />}
                {exps.map((e) => {
                  const links = (expAtt.data ?? []).filter((l) => l.entity_id === e.id);
                  if (!links.length) return null;
                  return (
                    <div key={e.id}>
                      <h3 className="mb-3 text-sm font-semibold text-slate-700"><span className="font-mono text-accent-700">{e.code}</span> {e.name}</h3>
                      <AttachmentGroups links={links} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No figures, audio or video attached yet.</p>
            )}
          </Sec>
          <Sec id="limitations" title="Known limitations"><MdOr md={c.limitations_md} /></Sec>
          <Sec id="status" title="Status & planned improvements">
            <p className="mb-3 text-sm text-slate-600">Current status: <StatusBadge status={c.status} label={componentStatusLabel[c.status]} /></p>
            <MdOr md={c.planned_md} empty="No planned improvements recorded." />
          </Sec>
          <Sec id="weekly" title="Related weekly updates">
            {relatedWeeks.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{relatedWeeks.map((w) => <WeekCard key={w.id} week={w} />)}</div>
            ) : (
              <p className="text-sm text-slate-400 italic">No weekly updates reference this component yet.</p>
            )}
          </Sec>
        </div>
      </div>
    </article>
  );
}
