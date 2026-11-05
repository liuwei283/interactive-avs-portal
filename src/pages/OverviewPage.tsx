import { Link } from 'react-router-dom';
import {
  useAsset, useDocuments, useExperiments, useMilestones, useModelComponents, useSiteSettings, useThrusts, useWeeklyUpdates,
} from '../lib/api';
import { Markdown } from '../components/content/Markdown';
import { DocumentListItem, ExperimentTable, WeekCard } from '../components/content/Cards';
import { EditLink, EmptyState, ErrorBox, Section, Spinner, StatusBadge } from '../components/ui';
import { ImageView } from '../components/media/ImageView';
import { useTitle } from '../lib/useTitle';
import { formatDate } from '../lib/dates';

function ArchitectureFigure({ assetId }: { assetId: string | null }) {
  const asset = useAsset(assetId);
  if (!assetId) {
    return (
      <EmptyState title="No architecture diagram uploaded yet">
        Upload an approved framework figure in Admin → Overview content. Until then, the formulations above describe the planned design.
      </EmptyState>
    );
  }
  if (asset.isLoading) return <Spinner />;
  if (!asset.data) return <ErrorBox error="The selected architecture diagram no longer exists." />;
  return <ImageView asset={asset.data} caption={asset.data.description || asset.data.title} />;
}

export default function OverviewPage() {
  const settings = useSiteSettings();
  const thrusts = useThrusts();
  const components = useModelComponents();
  const weeks = useWeeklyUpdates();
  const experiments = useExperiments();
  const documents = useDocuments();
  const milestones = useMilestones();
  const s = settings.data;
  useTitle('Overview');

  if (settings.isLoading) return <Spinner />;
  if (settings.error) return <ErrorBox error={settings.error} />;

  const latestWeek = weeks.data?.[0];
  const recentExperiments = (experiments.data ?? []).slice(0, 5);
  const importantDocs = (documents.data ?? []).filter((d) => d.important).slice(0, 6);
  const docsToShow = importantDocs.length ? importantDocs : (documents.data ?? []).slice(0, 5);
  const openMilestones = (milestones.data ?? []).filter((m) => m.status !== 'done');
  const countByThrust = (id: string) => (components.data ?? []).filter((c) => c.thrust_id === id).length;

  return (
    <div className="space-y-12">
      <div className="border-b border-slate-200 pb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="eyebrow mb-2">Research project overview</div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{s?.project_title || 'Project overview'}</h1>
            {(s?.affiliation || s?.collaboration) && (
              <p className="mt-2 text-slate-600">
                {s?.affiliation}
                {s?.affiliation && s?.collaboration ? ' · ' : ''}
                {s?.collaboration}
              </p>
            )}
            {s?.team_md && <Markdown className="mt-3 text-sm">{s.team_md}</Markdown>}
          </div>
          <EditLink to="/admin/overview" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {(s?.motivation_md || s?.objectives_md || s?.hypothesis_md) ? (
            <Section title="Motivation and objectives">
              <div className="space-y-6">
                <Markdown>{s?.motivation_md}</Markdown>
                {s?.hypothesis_md && (
                  <div className="rounded-md border-l-4 border-accent-500 bg-accent-50/60 px-4 py-3">
                    <div className="eyebrow mb-1 text-accent-700">Central hypothesis</div>
                    <Markdown>{s.hypothesis_md}</Markdown>
                  </div>
                )}
                <Markdown>{s?.objectives_md}</Markdown>
              </div>
            </Section>
          ) : (
            <EmptyState title="Overview content has not been added" action={<Link to="/admin/overview" className="btn-secondary">Add overview content</Link>}>
              Run the seed workflow (README → Content initialization) or write the motivation in the admin dashboard.
            </EmptyState>
          )}

          <Section title="Research thrusts" actions={<Link to="/models" className="text-sm text-accent-700 hover:underline">Open Models →</Link>}>
            {thrusts.isLoading ? (
              <Spinner />
            ) : thrusts.data?.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {thrusts.data.map((t) => (
                  <Link key={t.id} to={`/models#${t.slug}`} className="card flex flex-col p-4 hover:border-accent-200 hover:bg-accent-50/30">
                    <div className="eyebrow">Part {t.numeral}</div>
                    <div className="mt-1 font-semibold text-slate-900">{t.title}</div>
                    <Markdown className="mt-2 text-sm prose-p:my-1">{t.formulation_md}</Markdown>
                    <div className="mt-auto pt-3 text-xs text-slate-500">{countByThrust(t.id)} model components</div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No research thrusts defined yet" />
            )}
          </Section>

          <Section title="Architecture">
            {s?.architecture_md && <Markdown className="mb-4">{s.architecture_md}</Markdown>}
            <ArchitectureFigure assetId={s?.architecture_asset_id ?? null} />
          </Section>
        </div>

        <aside className="space-y-8">
          <Section title="Latest weekly progress" actions={<Link to="/progress" className="text-sm text-accent-700 hover:underline">All weeks</Link>}>
            {weeks.isLoading ? (
              <Spinner />
            ) : latestWeek ? (
              <WeekCard week={latestWeek} />
            ) : (
              <EmptyState title="No weekly updates yet" action={<Link to="/admin/weekly/new" className="btn-primary btn-sm">New weekly update</Link>} />
            )}
          </Section>

          <Section title="Important documents" actions={<Link to="/documents" className="text-sm text-accent-700 hover:underline">Library</Link>}>
            {docsToShow.length ? (
              <div className="card divide-y divide-slate-100 p-1">
                {docsToShow.map((d) => <DocumentListItem key={d.id} doc={d} />)}
              </div>
            ) : (
              <EmptyState title="No documents uploaded yet" />
            )}
          </Section>

          <Section title="Milestones" description="Proposal quarters are relative, not calendar commitments.">
            {openMilestones.length ? (
              <ol className="space-y-3">
                {openMilestones.slice(0, 6).map((m) => (
                  <li key={m.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {m.phase && <div className="eyebrow">{m.phase}</div>}
                        <div className="text-sm font-medium text-slate-800">{m.title}</div>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                    {m.target_date && <div className="mt-1 text-xs text-slate-500">Target: {formatDate(m.target_date)}</div>}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No upcoming milestones recorded" />
            )}
          </Section>
        </aside>
      </div>

      <Section title="Recent experiment updates" actions={<Link to="/models" className="text-sm text-accent-700 hover:underline">By component</Link>}>
        {experiments.isLoading ? (
          <Spinner />
        ) : recentExperiments.length ? (
          <ExperimentTable experiments={recentExperiments} components={components.data} />
        ) : (
          <EmptyState title="No experiment records yet" action={<Link to="/admin/experiments/new" className="btn-secondary btn-sm">Create an experiment record</Link>}>
            Experiments appear here once they are recorded. No results are shown until real runs are logged.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
