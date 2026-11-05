import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useAssets, useAttachments, useDocuments, useExperiments, useModelComponents, useWeeklyComponentLinks,
  useWeeklyExperimentLinks, useWeeklyUpdates,
} from '../lib/api';
import { formatDate, formatWeekRange } from '../lib/dates';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Markdown } from '../components/content/Markdown';
import { ExperimentSummary } from '../components/content/ExperimentSummary';
import { DocumentListItem } from '../components/content/Cards';
import { AttachmentGroups } from '../components/media/AttachmentGroups';
import { PdfPreview } from '../components/media/PdfPreview';
import { FileCard } from '../components/media/FileCard';
import { EditLink, EmptyState, PageHeader, QueryState, StatusBadge, Tag } from '../components/ui';
import NotFoundPage from './NotFoundPage';
import { useTitle } from '../lib/useTitle';
import type { WeeklyUpdate } from '../lib/types';
import { reportHeadings } from '../lib/reportBlocks';

const SECTIONS = [
  ['overview', 'A. Weekly overview'],
  ['materials', 'B. Meeting materials'],
  ['experiments', 'C. Experiments and results'],
  ['findings', 'D. Challenges and findings'],
  ['next', 'E. Next steps'],
  ['notes', 'F. Meeting notes'],
] as const;

function Block({ title, md }: { title: string; md: string }) {
  if (!md.trim()) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold text-slate-700">{title}</h3>
      <Markdown>{md}</Markdown>
    </div>
  );
}

function WeekSection({ id, title, children, empty, hideIfEmpty }: { id: string; title: string; children: ReactNode; empty: boolean; hideIfEmpty?: boolean }) {
  if (empty && hideIfEmpty) return null;
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
      <h2 className="section-title mb-4">{title}</h2>
      {empty ? <p className="text-sm text-slate-400 italic">Nothing recorded for this section yet.</p> : <div className="space-y-6">{children}</div>}
    </section>
  );
}

const has = (w: WeeklyUpdate, keys: (keyof WeeklyUpdate)[]) => keys.some((k) => String(w[k] ?? '').trim());

export default function WeeklyPage() {
  const { weekStart } = useParams();
  const weeks = useWeeklyUpdates();
  const w = weeks.data?.find((x) => x.week_start === weekStart);
  const expLinks = useWeeklyExperimentLinks();
  const compLinks = useWeeklyComponentLinks();
  const experiments = useExperiments();
  const components = useModelComponents();
  const documents = useDocuments();
  const assets = useAssets();
  const att = useAttachments('weekly_update', w?.id);
  useTitle(w ? `Week of ${w.week_start}` : 'Weekly update');

  if (weeks.isLoading) return <QueryState isLoading error={null}>{null}</QueryState>;
  if (weeks.error) return <QueryState isLoading={false} error={weeks.error}>{null}</QueryState>;
  if (!w) return <NotFoundPage what={`Weekly update for ${weekStart}`} />;

  const idx = weeks.data!.findIndex((x) => x.id === w.id);
  const newer = idx > 0 ? weeks.data![idx - 1] : null;
  const older = idx < weeks.data!.length - 1 ? weeks.data![idx + 1] : null;

  const linked = (expLinks.data ?? [])
    .filter((l) => l.weekly_update_id === w.id)
    .map((l) => ({ link: l, exp: experiments.data?.find((e) => e.id === l.experiment_id) }))
    .filter((x) => x.exp);
  const comps = (compLinks.data ?? [])
    .filter((l) => l.weekly_update_id === w.id)
    .map((l) => components.data?.find((c) => c.id === l.model_component_id))
    .filter(Boolean);
  const weekDocs = (documents.data ?? []).filter((d) => d.weekly_update_id === w.id);
  const attachments = att.data ?? [];
  const slides = attachments.filter((a) => a.role === 'slides' && a.asset);
  const media = attachments.filter((a) => a.role !== 'slides');
  const hasReport = !!w.report_md?.trim();
  const headings = hasReport ? reportHeadings(w.report_md) : [];
  const emptyOf: Record<string, boolean> = {
    overview: !has(w, ['goals_md', 'summary_md', 'accomplishments_md']),
    materials: !slides.length && !weekDocs.length && !has(w, ['agenda_md', 'discussion_questions_md']),
    experiments: !linked.length && !media.length && !has(w, ['implementation_changes_md', 'results_md']),
    findings: !has(w, ['issues_md', 'failed_experiments_md', 'hypotheses_md', 'lessons_md', 'uncertainties_md']),
    next: !has(w, ['planned_experiments_md', 'priorities_md', 'followups_md', 'open_questions_md']),
    notes: !has(w, ['discussion_notes_md', 'decisions_md', 'action_items_md']),
  };
  const tocSections = SECTIONS.filter(([id]) => !(hasReport && emptyOf[id]));
  const slideDocs = weekDocs.map((d) => ({ d, file: assets.data?.find((a) => a.id === d.file_asset_id), preview: assets.data?.find((a) => a.id === d.preview_asset_id) }));

  return (
    <article>
      <Breadcrumbs items={[{ label: 'Weekly Progress', to: '/progress' }, { label: `Week of ${formatDate(w.week_start)}` }]} />
      <PageHeader
        eyebrow={formatWeekRange(w.week_start)}
        title={w.title || `Week of ${formatDate(w.week_start)}`}
        description={w.research_focus ? <><span className="font-medium text-slate-700">Research focus:</span> {w.research_focus}</> : undefined}
        meta={
          <>
            <StatusBadge status={w.status} />
            {w.meeting_date && <span>Meeting: {formatDate(w.meeting_date)}</span>}
            <span>Last edited {formatDate(w.updated_at)}</span>
            {comps.map((c) => <Link key={c!.id} to={`/models/${c!.slug}`}><Tag>{c!.title}</Tag></Link>)}
          </>
        }
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>Print</button>
            <EditLink to={`/admin/weekly/${w.id}`} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="On this page" className="no-print hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <div className="eyebrow mb-2">On this page</div>
          <ul className="space-y-1 text-sm">
            {hasReport && (
              <li>
                <a href="#report" className="block rounded px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900">Weekly report</a>
                {headings.length > 0 && (
                  <ul className="mb-1 ml-2 border-l border-slate-200">
                    {headings.map((h) => (
                      <li key={h.id}><a href={`#${h.id}`} className={`block py-0.5 pr-2 text-[13px] text-slate-500 hover:text-slate-900 ${h.level === 3 ? 'pl-5' : 'pl-3'}`}>{h.text}</a></li>
                    ))}
                  </ul>
                )}
              </li>
            )}
            {tocSections.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900">{label}</a></li>
            ))}
          </ul>
          <div className="mt-6 space-y-1 border-t border-slate-200 pt-4 text-sm">
            {newer && <Link to={`/progress/${newer.week_start}`} className="block text-accent-700 hover:underline">← Newer: {newer.week_start}</Link>}
            {older && <Link to={`/progress/${older.week_start}`} className="block text-accent-700 hover:underline">Older: {older.week_start} →</Link>}
          </div>
        </nav>

        <div className="min-w-0 space-y-10">
          {hasReport && (
            <section id="report" className="scroll-mt-24">
              <Markdown>{w.report_md}</Markdown>
            </section>
          )}
          <WeekSection id="overview" title="A. Weekly overview" empty={emptyOf.overview} hideIfEmpty={hasReport}>
            <Block title="Progress summary" md={w.summary_md} />
            <Block title="Main goals" md={w.goals_md} />
            <Block title="Important accomplishments" md={w.accomplishments_md} />
          </WeekSection>

          <WeekSection id="materials" title="B. Meeting materials" empty={emptyOf.materials} hideIfEmpty={hasReport}>
            {slideDocs.map(({ d, file, preview }) => (
              <div key={d.id} className="space-y-2">
                <DocumentListItem doc={d} />
                {file?.kind === 'pdf' ? <PdfPreview asset={file} height="h-[560px]" /> : preview?.kind === 'pdf' ? <PdfPreview asset={preview} height="h-[560px]" /> : file ? <FileCard asset={file} /> : null}
              </div>
            ))}
            {slides.map((s) =>
              s.asset!.kind === 'pdf' ? (
                <PdfPreview key={s.id} asset={s.asset!} label={s.label || 'Slides'} caption={s.caption} height="h-[560px]" />
              ) : (
                <FileCard key={s.id} asset={s.asset!} label={s.label || 'Slides'} caption={s.caption} />
              ),
            )}
            <Block title="Agenda" md={w.agenda_md} />
            <Block title="Discussion questions" md={w.discussion_questions_md} />
          </WeekSection>

          <WeekSection id="experiments" title="C. Experiments and results" empty={emptyOf.experiments} hideIfEmpty={hasReport}>
            <Block title="Implementation changes" md={w.implementation_changes_md} />
            {linked.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Linked experiment records</h3>
                {linked.map(({ link, exp }) => (
                  <ExperimentSummary key={exp!.id} e={exp!} note={link.note} component={components.data?.find((c) => c.id === exp!.model_component_id)} />
                ))}
              </div>
            )}
            <Block title="Results and figures" md={w.results_md} />
            {media.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Figures, demos and comparisons</h3>
                <AttachmentGroups links={media} />
              </div>
            )}
          </WeekSection>

          <WeekSection id="findings" title="D. Challenges and findings" empty={emptyOf.findings} hideIfEmpty={hasReport}>
            <Block title="Issues encountered" md={w.issues_md} />
            <Block title="Failed experiments" md={w.failed_experiments_md} />
            <Block title="Hypotheses tested" md={w.hypotheses_md} />
            <Block title="Lessons learned" md={w.lessons_md} />
            <Block title="Remaining uncertainties" md={w.uncertainties_md} />
          </WeekSection>

          <WeekSection id="next" title="E. Next steps" empty={emptyOf.next} hideIfEmpty={hasReport}>
            <Block title="Planned experiments" md={w.planned_experiments_md} />
            <Block title="Priorities" md={w.priorities_md} />
            <Block title="Follow-up tasks" md={w.followups_md} />
            <Block title="Open questions for collaborators" md={w.open_questions_md} />
          </WeekSection>

          <WeekSection id="notes" title="F. Meeting notes" empty={emptyOf.notes} hideIfEmpty={hasReport}>
            <Block title="Discussion notes" md={w.discussion_notes_md} />
            <Block title="Decisions" md={w.decisions_md} />
            <Block title="Action items" md={w.action_items_md} />
          </WeekSection>

          {!hasReport && !linked.length && !attachments.length && w.status === 'draft' && (
            <EmptyState title="This week is a draft" action={<Link to={`/admin/weekly/${w.id}`} className="btn-primary btn-sm">Continue editing</Link>}>
              Add the summary, upload slides and demos, link experiment records, then publish.
            </EmptyState>
          )}
        </div>
      </div>
    </article>
  );
}
