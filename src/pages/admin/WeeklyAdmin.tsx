import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  invalidateAll, useExperiments, useModelComponents, useWeeklyComponentLinks, useWeeklyExperimentLinks, useWeeklyUpdates,
} from '../../lib/api';
import { formatDate, formatWeekRange, mondayOf, toISODate, weekStartFor } from '../../lib/dates';
import type { WeeklyUpdate } from '../../lib/types';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { EmptyState, ErrorBox, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import { Field, FormCard, TextInput } from '../../components/admin/Field';
import { MarkdownField } from '../../components/admin/MarkdownField';
import { AttachmentsEditor } from '../../components/admin/AttachmentsEditor';
import { SaveBar } from '../../components/admin/SaveBar';
import { friendlyDbError, useEntityForm } from '../../components/admin/useEntityForm';

export default function WeeklyAdmin() {
  const weeks = useWeeklyUpdates();
  return (
    <>
      <PageHeader title="Weekly updates" actions={<Link to="/admin/weekly/new" className="btn-primary">New weekly update</Link>} />
      {weeks.isLoading ? (
        <Spinner />
      ) : !weeks.data?.length ? (
        <EmptyState title="No weekly updates yet" action={<Link to="/admin/weekly/new" className="btn-primary btn-sm">Create the first one</Link>} />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {weeks.data.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <Link to={`/admin/weekly/${w.id}`} className="font-medium text-slate-900 hover:underline">Week of {formatDate(w.week_start)}</Link>
                <span className="ml-2 text-xs text-slate-500">{formatWeekRange(w.week_start)}</span>
                {w.title && <div className="text-sm text-slate-600">{w.title}</div>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={w.status} />
                <Link to={`/progress/${w.week_start}`} className="btn-secondary btn-sm">View</Link>
                <Link to={`/admin/weekly/${w.id}`} className="btn-secondary btn-sm">Edit</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function WeeklyNew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const weeks = useWeeklyUpdates();
  const [date, setDate] = useState(toISODate(mondayOf(new Date())));
  const [carry, setCarry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const weekStart = weekStartFor(date);
  const existing = weeks.data?.find((w) => w.week_start === weekStart);
  const previous = (weeks.data ?? []).find((w) => weekStart && w.week_start < weekStart);

  const create = async () => {
    if (!weekStart) return setError('Choose a valid date.');
    setBusy(true);
    setError(null);
    const row: Partial<WeeklyUpdate> = { week_start: weekStart, status: 'draft' };
    if (carry && previous) {
      const carried = [previous.planned_experiments_md, previous.priorities_md, previous.followups_md].filter((s) => s.trim()).join('\n\n');
      if (carried) row.goals_md = `_Carried over from the week of ${previous.week_start}:_\n\n${carried}`;
    }
    const { data, error: e } = await supabase.from('weekly_updates').insert(row).select().single();
    setBusy(false);
    if (e) return setError(friendlyDbError(e.message));
    await invalidateAll(qc);
    navigate(`/admin/weekly/${data.id}`, { replace: true });
  };

  return (
    <>
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Weekly updates', to: '/admin/weekly' }, { label: 'New' }]} />
      <PageHeader title="New weekly update" description="Weeks start on Monday. Any date you pick is mapped to the Monday of its week; that date becomes the page URL." />
      <FormCard title="1. Select the week">
        <Field label="Any date in the week" htmlFor="week-date" help={weekStart ? `Week of ${formatDate(weekStart)} (${formatWeekRange(weekStart)}) → /progress/${weekStart}` : undefined}>
          <input id="week-date" type="date" className="input max-w-xs" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {previous && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
            Pre-fill “Main goals” with the next steps from the week of {formatDate(previous.week_start)}
          </label>
        )}
        {existing ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This week already has a page. <Link className="font-medium underline" to={`/admin/weekly/${existing.id}`}>Edit it instead</Link>.
          </div>
        ) : (
          <button type="button" className="btn-primary" disabled={busy || !weekStart} onClick={() => void create()}>
            {busy ? 'Creating…' : 'Create draft and continue'}
          </button>
        )}
        {error && <ErrorBox error={error} />}
      </FormCard>
    </>
  );
}

function LinkedExperiments({ weekId }: { weekId: string }) {
  const qc = useQueryClient();
  const exps = useExperiments();
  const links = useWeeklyExperimentLinks();
  const [pick, setPick] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const mine = (links.data ?? []).filter((l) => l.weekly_update_id === weekId);
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    setErr(null);
    const { error } = await p;
    if (error) setErr(friendlyDbError(error.message));
    await invalidateAll(qc);
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {mine.map((l) => {
          const e = exps.data?.find((x) => x.id === l.experiment_id);
          return (
            <li key={l.experiment_id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span><span className="font-mono text-accent-700">{e?.code}</span> {e?.name}</span>
                <span className="flex gap-1.5">
                  {e && <Link to={`/admin/experiments/${e.id}`} className="btn-secondary btn-sm">Edit record</Link>}
                  <button type="button" className="btn-danger btn-sm" onClick={() => void run(supabase.from('weekly_update_experiments').delete().eq('weekly_update_id', weekId).eq('experiment_id', l.experiment_id))}>Unlink</button>
                </span>
              </div>
              <input
                className="input mt-2"
                placeholder="Note for this week (optional): what changed in this experiment this week"
                defaultValue={l.note}
                aria-label="Note for this week"
                onBlur={(ev) => ev.target.value !== l.note && void run(supabase.from('weekly_update_experiments').update({ note: ev.target.value }).eq('weekly_update_id', weekId).eq('experiment_id', l.experiment_id))}
              />
            </li>
          );
        })}
        {!mine.length && <li className="text-sm text-slate-400 italic">No experiments linked.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        <select className="input max-w-md" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Experiment to link">
          <option value="">Choose an existing experiment…</option>
          {(exps.data ?? []).filter((e) => !mine.some((m) => m.experiment_id === e.id)).map((e) => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
        </select>
        <button type="button" className="btn-secondary" disabled={!pick} onClick={() => { void run(supabase.from('weekly_update_experiments').insert({ weekly_update_id: weekId, experiment_id: pick, sort_order: mine.length * 10 })); setPick(''); }}>Link</button>
        <Link to={`/admin/experiments/new?week=${weekId}`} className="btn-secondary">Create new experiment for this week</Link>
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}

function LinkedComponents({ weekId }: { weekId: string }) {
  const qc = useQueryClient();
  const comps = useModelComponents();
  const links = useWeeklyComponentLinks();
  const on = new Set((links.data ?? []).filter((l) => l.weekly_update_id === weekId).map((l) => l.model_component_id));
  const toggle = async (id: string) => {
    if (on.has(id)) await supabase.from('weekly_update_components').delete().eq('weekly_update_id', weekId).eq('model_component_id', id);
    else await supabase.from('weekly_update_components').insert({ weekly_update_id: weekId, model_component_id: id });
    await invalidateAll(qc);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {(comps.data ?? []).map((c) => (
        <button key={c.id} type="button" onClick={() => void toggle(c.id)} aria-pressed={on.has(c.id)} className={`rounded-full border px-2.5 py-1 text-xs ${on.has(c.id) ? 'border-accent-700 bg-accent-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
          {c.title}
        </button>
      ))}
    </div>
  );
}

const TABS = ['Report', 'A. Overview', 'B. Meeting materials', 'C. Experiments & results', 'D. Challenges & findings', 'E. Next steps', 'F. Meeting notes'] as const;

export function WeeklyEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const f = useEntityForm<WeeklyUpdate>('weekly_updates', id, {});
  const [tab, setTab] = useState<(typeof TABS)[number]>('Report');
  const w = f.row;
  if (f.loading) return <Spinner />;
  if (!w.id) return <ErrorBox error={f.error ?? 'Not found'} />;

  const md = (key: keyof WeeklyUpdate, label: string, rows = 5, help?: string) => (
    <MarkdownField id={String(key)} label={label} rows={rows} help={help} folder={`weekly/${w.week_start}`} value={String(w[key] ?? '')} onChange={(v) => f.set(key, v as never)} />
  );

  const remove = async () => {
    if (!confirm(`Delete the weekly update for ${w.week_start}? Linked experiments and files are kept; only this page and its links are removed.`)) return;
    const { error } = await supabase.from('weekly_updates').delete().eq('id', w.id!);
    if (error) return f.setError(friendlyDbError(error.message));
    await invalidateAll(qc);
    navigate('/admin/weekly', { replace: true });
  };

  return (
    <>
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Weekly updates', to: '/admin/weekly' }, { label: w.week_start! }]} />
      <PageHeader
        eyebrow={formatWeekRange(w.week_start!)}
        title={`Week of ${formatDate(w.week_start)}`}
        meta={<StatusBadge status={w.status ?? 'draft'} />}
        actions={<Link to={`/progress/${w.week_start}`} className="btn-secondary">View page</Link>}
      />
      <div className="space-y-6">
        <FormCard title="Basics">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Title (optional)" htmlFor="title" className="md:col-span-2"><TextInput id="title" value={w.title} onChange={(v) => f.set('title', v)} placeholder="e.g. Baseline reproduction and data audit" /></Field>
            <Field label="Meeting date" htmlFor="meeting"><input id="meeting" type="date" className="input" value={w.meeting_date ?? ''} onChange={(e) => f.set('meeting_date', e.target.value || null)} /></Field>
          </div>
          <Field label="Research focus" htmlFor="focus"><TextInput id="focus" value={w.research_focus} onChange={(v) => f.set('research_focus', v)} placeholder="One line" /></Field>
          <Field label="Related model components"><LinkedComponents weekId={w.id} /></Field>
        </FormCard>

        <div className="flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-accent-700 font-medium text-accent-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Report' && (
          <FormCard
            title="Weekly report (free-form)"
            description={<>Shown first on the week page; any layout. Usually written by a coding agent and published with <code>npm run sync:week</code>{w.report_source ? <> from <code>{w.report_source}</code></> : null}. Edits here are overwritten by the next sync of that folder.</>}
          >
            {md('report_md', 'Report', 22, 'Rich blocks: ```compare-audio / compare-video / compare-image / gallery / metrics.')}
          </FormCard>
        )}
        {tab === 'A. Overview' && (
          <FormCard title="Weekly overview">
            {md('summary_md', 'Progress summary', 6, 'Top things that changed this week.')}
            {md('goals_md', 'Main goals')}
            {md('accomplishments_md', 'Important accomplishments', 5, 'Link evidence: experiments, figures, documents.')}
          </FormCard>
        )}
        {tab === 'B. Meeting materials' && (
          <FormCard title="Meeting materials" description="Upload this week's slides (PDF previews inline; PPTX is offered as a download). For a PPTX, also upload its PDF export.">
            <AttachmentsEditor entityType="weekly_update" entityId={w.id} folder={`weekly/${w.week_start}`} roles={['slides', 'attachment']} preferredRole="slides" title="Slides and handouts" />
            {md('agenda_md', 'Meeting agenda')}
            {md('discussion_questions_md', 'Discussion questions')}
          </FormCard>
        )}
        {tab === 'C. Experiments & results' && (
          <FormCard title="Experiments and results" description="Experiment records live independently and can be linked from several weeks; metrics and demos attached to the record show here automatically.">
            <Field label="Linked experiment records"><LinkedExperiments weekId={w.id} /></Field>
            {md('implementation_changes_md', 'Implementation changes')}
            {md('results_md', 'Results, figures and comparisons (free-form)', 6)}
            <AttachmentsEditor entityType="weekly_update" entityId={w.id} folder={`weekly/${w.week_start}`} roles={['figure', 'audio', 'video', 'comparison', 'data', 'attachment']} title="Figures, plots, audio and video demos" />
          </FormCard>
        )}
        {tab === 'D. Challenges & findings' && (
          <FormCard title="Challenges and findings">
            {md('issues_md', 'Issues encountered')}
            {md('failed_experiments_md', 'Failed experiments')}
            {md('hypotheses_md', 'Hypotheses tested')}
            {md('lessons_md', 'Lessons learned')}
            {md('uncertainties_md', 'Remaining uncertainties')}
          </FormCard>
        )}
        {tab === 'E. Next steps' && (
          <FormCard title="Next steps">
            {md('planned_experiments_md', 'Planned experiments')}
            {md('priorities_md', 'Priorities')}
            {md('followups_md', 'Follow-up tasks')}
            {md('open_questions_md', 'Open questions for collaborators')}
          </FormCard>
        )}
        {tab === 'F. Meeting notes' && (
          <FormCard title="Meeting notes" description="Fill in during or after the meeting.">
            {md('discussion_notes_md', 'Discussion notes', 6)}
            {md('decisions_md', 'Decisions')}
            {md('action_items_md', 'Action items', 5, 'Tip: use a task list, e.g. "- [ ] Owner: task".')}
          </FormCard>
        )}
      </div>

      <SaveBar dirty={f.dirty} saving={f.saving} error={f.error} savedAt={f.savedAt}>
        <button type="button" className="btn-danger" onClick={() => void remove()}>Delete</button>
        <button type="button" className="btn-secondary" disabled={f.saving} onClick={() => void f.save()}>Save {w.status === 'published' ? '' : 'draft'}</button>
        {w.status === 'published' ? (
          <button type="button" className="btn-secondary" disabled={f.saving} onClick={() => void f.save({ status: 'draft' })}>Unpublish</button>
        ) : (
          <button type="button" className="btn-primary" disabled={f.saving} onClick={async () => { const r = await f.save({ status: 'published' }); if (r) navigate(`/progress/${r.week_start}`); }}>
            Save and publish
          </button>
        )}
      </SaveBar>
    </>
  );
}
