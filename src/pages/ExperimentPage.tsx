import { Link, useParams } from 'react-router-dom';
import { useAttachments, useExperiments, useMetrics, useModelComponents, useWeeklyExperimentLinks, useWeeklyUpdates } from '../lib/api';
import { experimentStatusLabel } from '../lib/labels';
import { formatDate } from '../lib/dates';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Markdown } from '../components/content/Markdown';
import { WeekCard } from '../components/content/Cards';
import { AttachmentGroups } from '../components/media/AttachmentGroups';
import { MetricTable } from '../components/media/MetricTable';
import { MetricBars } from '../components/media/MetricBars';
import { EditLink, KeyValue, PageHeader, QueryState, Section, StatusBadge } from '../components/ui';
import NotFoundPage from './NotFoundPage';
import { useTitle } from '../lib/useTitle';

function Md({ title, md }: { title: string; md: string }) {
  if (!md.trim()) return null;
  return <Section title={title}><Markdown>{md}</Markdown></Section>;
}

export default function ExperimentPage() {
  const { code } = useParams();
  const experiments = useExperiments();
  const components = useModelComponents();
  const weeks = useWeeklyUpdates();
  const wl = useWeeklyExperimentLinks();
  const e = experiments.data?.find((x) => x.code === code);
  const metrics = useMetrics(e ? [e.id] : []);
  const att = useAttachments('experiment', e?.id);
  useTitle(e ? `${e.code} ${e.name}` : 'Experiment');

  if (experiments.isLoading) return <QueryState isLoading error={null}>{null}</QueryState>;
  if (!e) return <NotFoundPage what={`Experiment ${code}`} />;
  const comp = components.data?.find((c) => c.id === e.model_component_id);
  const weekIds = new Set((wl.data ?? []).filter((l) => l.experiment_id === e.id).map((l) => l.weekly_update_id));
  const relatedWeeks = (weeks.data ?? []).filter((w) => weekIds.has(w.id));

  return (
    <article>
      <Breadcrumbs items={[{ label: 'Models', to: '/models' }, ...(comp ? [{ label: comp.title, to: `/models/${comp.slug}` }] : []), { label: e.code }]} />
      <PageHeader
        eyebrow={<span className="font-mono">{e.code}</span>}
        title={e.name}
        meta={
          <>
            <StatusBadge status={e.status} label={experimentStatusLabel[e.status]} />
            {!e.published && <StatusBadge status="draft" />}
            <span>{formatDate(e.experiment_date)}</span>
          </>
        }
        actions={<EditLink to={`/admin/experiments/${e.id}`} />}
      />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-8">
          {(e.research_question || e.hypothesis) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {e.research_question && <div className="card p-4"><div className="eyebrow mb-1">Research question</div><p className="text-sm text-slate-800">{e.research_question}</p></div>}
              {e.hypothesis && <div className="card p-4"><div className="eyebrow mb-1">Hypothesis</div><p className="text-sm text-slate-800">{e.hypothesis}</p></div>}
            </div>
          )}
          <Md title="Configuration" md={e.config_md} />
          <Md title="Baseline comparisons" md={e.baseline_md} />
          <Section title="Evaluation metrics">
            {metrics.data?.length ? (
              <div className="space-y-4">
                <MetricTable metrics={metrics.data} />
                <MetricBars metrics={metrics.data} />
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No metrics recorded.</p>
            )}
          </Section>
          {!!att.data?.length && <Section title="Figures, audio and video"><AttachmentGroups links={att.data} /></Section>}
          <Md title="Observations" md={e.observations_md} />
          <Md title="Conclusions" md={e.conclusions_md} />
          <Md title="Limitations" md={e.limitations_md} />
          <Section title="Related weekly updates">
            {relatedWeeks.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{relatedWeeks.map((w) => <WeekCard key={w.id} week={w} />)}</div>
            ) : (
              <p className="text-sm text-slate-400 italic">Not linked to any weekly update yet.</p>
            )}
          </Section>
        </div>
        <aside>
          <KeyValue
            items={[
              ['Experiment ID', <span className="font-mono">{e.code}</span>],
              ['Component', comp ? <Link to={`/models/${comp.slug}`} className="text-accent-700 hover:underline">{comp.title}</Link> : ''],
              ['Dataset', e.dataset],
              ['Model / checkpoint', e.model_checkpoint],
              ['Date', formatDate(e.experiment_date)],
              ['Last edited', formatDate(e.updated_at)],
            ]}
          />
          <p className="mt-6 text-xs text-slate-500">Link from Markdown with <code>[text](exp:{e.code})</code>.</p>
        </aside>
      </div>
    </article>
  );
}
