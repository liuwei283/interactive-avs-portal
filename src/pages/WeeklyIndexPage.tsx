import { Link, useSearchParams } from 'react-router-dom';
import { useWeeklyExperimentLinks, useWeeklyUpdates } from '../lib/api';
import { WeekCard } from '../components/content/Cards';
import { EmptyState, PageHeader, QueryState } from '../components/ui';
import { useTitle } from '../lib/useTitle';

export default function WeeklyIndexPage() {
  useTitle('Weekly Progress');
  const weeks = useWeeklyUpdates();
  const links = useWeeklyExperimentLinks();
  const [params, setParams] = useSearchParams();
  const showDrafts = params.get('drafts') !== '0';
  const visible = (weeks.data ?? []).filter((w) => showDrafts || w.status === 'published');
  const byYear = new Map<string, typeof visible>();
  for (const w of visible) byYear.set(w.week_start.slice(0, 4), [...(byYear.get(w.week_start.slice(0, 4)) ?? []), w]);

  return (
    <>
      <PageHeader
        eyebrow="Research journal"
        title="Weekly Progress"
        description="One page per week (weeks start on Monday), newest first."
        actions={<Link to="/admin/weekly/new" className="btn-primary">New weekly update</Link>}
      />
      <label className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={showDrafts} onChange={(e) => setParams(e.target.checked ? {} : { drafts: '0' }, { replace: true })} />
        Include drafts
      </label>
      <QueryState isLoading={weeks.isLoading} error={weeks.error}>
        {!visible.length ? (
          <EmptyState title="No weekly updates yet" action={<Link to="/admin/weekly/new" className="btn-primary btn-sm">Create the first weekly update</Link>}>
            Each week gets its own page at <code>/progress/YYYY-MM-DD</code> with overview, meeting materials, experiments, findings, next steps and meeting notes.
          </EmptyState>
        ) : (
          <div className="space-y-8">
            {[...byYear.entries()].map(([year, ws]) => (
              <section key={year}>
                <h2 className="eyebrow mb-3">{year}</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {ws.map((w) => (
                    <WeekCard key={w.id} week={w} experimentsCount={links.data?.filter((l) => l.weekly_update_id === w.id).length} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
