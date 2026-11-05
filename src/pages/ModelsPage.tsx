import { Link } from 'react-router-dom';
import { useExperiments, useModelComponents, useThrusts } from '../lib/api';
import { componentStatusLabel } from '../lib/labels';
import { ComponentCard } from '../components/content/Cards';
import { Markdown } from '../components/content/Markdown';
import { EditLink, EmptyState, PageHeader, QueryState } from '../components/ui';
import { useTitle } from '../lib/useTitle';
import type { ModelComponent } from '../lib/types';

export default function ModelsPage() {
  useTitle('Models');
  const thrusts = useThrusts();
  const components = useModelComponents();
  const experiments = useExperiments();
  const all = components.data ?? [];
  const byThrust = (id: string | null) => all.filter((c) => c.thrust_id === id);
  const unassigned = all.filter((c) => !c.thrust_id || !thrusts.data?.some((t) => t.id === c.thrust_id));
  const expCount = (c: ModelComponent) => (experiments.data ?? []).filter((e) => e.model_component_id === c.id).length;
  const statusCounts = Object.entries(componentStatusLabel)
    .map(([k, label]) => [label, all.filter((c) => c.status === k).length] as const)
    .filter(([, n]) => n);

  return (
    <>
      <PageHeader
        eyebrow="Model development"
        title="Models"
        description="Technical source of truth per research component: design, implementation, experiment records and evidence. Weekly Progress records what happened when; this section records what we currently know."
        meta={statusCounts.map(([l, n]) => <span key={l}>{n} {l.toLowerCase()}</span>)}
        actions={<Link to="/admin/models/new" className="btn-primary">New component</Link>}
      />
      <QueryState isLoading={thrusts.isLoading || components.isLoading} error={thrusts.error || components.error}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[15rem_1fr]">
          <nav aria-label="Components" className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
            {(thrusts.data ?? []).map((t) => (
              <div key={t.id} className="mb-5">
                <a href={`#${t.slug}`} className="eyebrow block hover:text-slate-800">Part {t.numeral}</a>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {byThrust(t.id).map((c) => (
                    <li key={c.id}><Link to={`/models/${c.slug}`} className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900">{c.title}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="min-w-0 space-y-14">
            {!thrusts.data?.length && !all.length && (
              <EmptyState title="No research thrusts or components yet" action={<Link to="/admin/overview" className="btn-secondary btn-sm">Define thrusts</Link>}>
                Run the seed workflow to create the three proposal thrusts and their component structure.
              </EmptyState>
            )}
            {(thrusts.data ?? []).map((t) => (
              <section key={t.id} id={t.slug} className="scroll-mt-24">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <div className="eyebrow">Part {t.numeral}</div>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">{t.title}</h2>
                    <Markdown className="mt-2">{t.summary_md}</Markdown>
                  </div>
                  <EditLink to="/admin/overview" />
                </div>
                {t.formulation_md && (
                  <div className="mb-5 rounded-md border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <div className="eyebrow mb-1">Formulation (proposed)</div>
                    <Markdown>{t.formulation_md}</Markdown>
                  </div>
                )}
                {byThrust(t.id).length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {byThrust(t.id).map((c) => <ComponentCard key={c.id} c={c} experimentCount={expCount(c)} />)}
                  </div>
                ) : (
                  <EmptyState title="No components in this thrust yet" />
                )}
              </section>
            ))}
            {unassigned.length > 0 && (
              <section>
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Other components</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {unassigned.map((c) => <ComponentCard key={c.id} c={c} experimentCount={expCount(c)} />)}
                </div>
              </section>
            )}
          </div>
        </div>
      </QueryState>
    </>
  );
}
