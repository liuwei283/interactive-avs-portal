import { Link, useSearchParams } from 'react-router-dom';
import { usePapers, useSurveyCategories } from '../lib/api';
import { filterPapers, type SortKey } from '../lib/surveyFilter';
import { publicationStatusLabel, readingStatusLabel } from '../lib/labels';
import type { PaperWithCategories, ReadingStatus, SurveyCategory } from '../lib/types';
import { Badge, EmptyState, PageHeader, QueryState, StatusBadge, Tag } from '../components/ui';
import { firstLine } from '../components/content/Cards';
import { useTitle } from '../lib/useTitle';

function PaperCard({ p, categories }: { p: PaperWithCategories; categories: SurveyCategory[] }) {
  const cats = p.paper_category_links.map((l) => categories.find((c) => c.slug === l.category_slug)?.title).filter(Boolean);
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link to={`/survey/${p.slug}`} className="font-semibold text-slate-900 hover:text-accent-700 hover:underline">
          {p.title}
        </Link>
        <div className="flex items-center gap-1.5">
          {p.team_prior_work && <Badge tone="accent" title="Prior work by members of the proposing team">Team prior work</Badge>}
          <StatusBadge status={p.reading_status} label={readingStatusLabel[p.reading_status]} />
        </div>
      </div>
      <div className="mt-1 text-sm text-slate-600">{p.authors || <span className="text-slate-400 italic">Authors not recorded</span>}</div>
      <div className="mt-0.5 text-sm text-slate-500">
        {[p.venue, p.year].filter(Boolean).join(' ') || 'Venue/year not recorded'}
        {p.publication_status !== 'published' && <span> · {publicationStatusLabel[p.publication_status]}</span>}
      </div>
      {p.summary_md && <p className="mt-2 text-sm text-slate-700">{firstLine(p.summary_md, 260)}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {cats.map((c) => <Tag key={c}>{c}</Tag>)}
        {p.tags.map((t) => <span key={t} className="text-xs text-slate-400">#{t}</span>)}
        <span className="ml-auto flex gap-3 text-xs">
          {p.paper_url && <a href={p.paper_url} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">Paper</a>}
          {p.project_url && <a href={p.project_url} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">Project</a>}
          {p.code_url && <a href={p.code_url} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">Code</a>}
        </span>
      </div>
    </article>
  );
}

export default function SurveyPage() {
  useTitle('Survey');
  const papers = usePapers();
  const cats = useSurveyCategories();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const category = params.get('category');
  const status = (params.get('status') as ReadingStatus | null) ?? 'all';
  const sort = (params.get('sort') as SortKey | null) ?? 'year_desc';

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const all = papers.data ?? [];
  const visible = filterPapers(all, { query, category, status, sort });
  const count = (slug: string) => all.filter((p) => p.paper_category_links.some((l) => l.category_slug === slug)).length;

  return (
    <>
      <PageHeader
        eyebrow="Literature"
        title="Survey"
        description="Organized related work and reading notes. Bibliographic details should be verified against the original publications."
        actions={<Link to="/admin/papers/new" className="btn-primary">Add paper</Link>}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Categories" className="lg:sticky lg:top-20 lg:self-start">
          <select className="input lg:hidden" aria-label="Category" value={category ?? ''} onChange={(e) => set('category', e.target.value || null)}>
            <option value="">All categories ({all.length})</option>
            {(cats.data ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.title} ({count(c.slug)})</option>)}
          </select>
          <div className="eyebrow mb-2 hidden lg:block">Categories</div>
          <ul className="hidden space-y-0.5 text-sm lg:block">
            <li>
              <button type="button" onClick={() => set('category', null)} className={`flex w-full justify-between rounded px-2 py-1.5 text-left ${!category ? 'bg-accent-50 font-medium text-accent-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                <span>All papers</span>
                <span className="text-slate-400">{all.length}</span>
              </button>
            </li>
            {(cats.data ?? []).map((c) => (
              <li key={c.slug}>
                <button type="button" onClick={() => set('category', c.slug)} title={c.description} className={`flex w-full justify-between gap-2 rounded px-2 py-1.5 text-left ${category === c.slug ? 'bg-accent-50 font-medium text-accent-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <span>{c.title}</span>
                  <span className="text-slate-400">{count(c.slug)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="min-w-0">
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="search"
              className="input"
              placeholder="Search title, authors, tags, notes…"
              aria-label="Search papers"
              value={query}
              onChange={(e) => set('q', e.target.value || null)}
            />
            <select className="input" aria-label="Reading status" value={status} onChange={(e) => set('status', e.target.value === 'all' ? null : e.target.value)}>
              <option value="all">All statuses</option>
              {Object.entries(readingStatusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="input" aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value === 'year_desc' ? null : e.target.value)}>
              <option value="year_desc">Newest first</option>
              <option value="year_asc">Oldest first</option>
              <option value="title">Title A–Z</option>
              <option value="added">Recently added</option>
              <option value="status">Reading status</option>
            </select>
          </div>
          <QueryState isLoading={papers.isLoading || cats.isLoading} error={papers.error || cats.error}>
            <p className="mb-3 text-sm text-slate-500">{visible.length} of {all.length} papers</p>
            {visible.length ? (
              <div className="space-y-3">{visible.map((p) => <PaperCard key={p.id} p={p} categories={cats.data ?? []} />)}</div>
            ) : (
              <EmptyState title={all.length ? 'No papers match these filters' : 'No papers in the survey yet'}>
                {all.length ? 'Try clearing the search or category.' : 'Add references from the admin dashboard or run the seed workflow.'}
              </EmptyState>
            )}
          </QueryState>
        </div>
      </div>
    </>
  );
}
