import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invalidateAll, useExperiments, useMetrics, useModelComponents, useWeeklyExperimentLinks, useWeeklyUpdates } from '../../lib/api';
import { experimentStatusLabel } from '../../lib/labels';
import { isValidExperimentCode, nextExperimentCode } from '../../lib/slug';
import { formatDate } from '../../lib/dates';
import type { Experiment, ExperimentMetric, ExperimentStatus } from '../../lib/types';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { EmptyState, ErrorBox, NoticeBox, PageHeader, Spinner } from '../../components/ui';
import { ExperimentTable } from '../../components/content/Cards';
import { Field, FormCard, Select, TextInput } from '../../components/admin/Field';
import { MarkdownField } from '../../components/admin/MarkdownField';
import { AttachmentsEditor } from '../../components/admin/AttachmentsEditor';
import { SaveBar } from '../../components/admin/SaveBar';
import { friendlyDbError, useEntityForm } from '../../components/admin/useEntityForm';

export default function ExperimentsAdmin() {
  const exps = useExperiments();
  const comps = useModelComponents();
  return (
    <>
      <PageHeader title="Experiments" description="Stable, reusable experiment records. Link them from weekly pages; they appear under their model component automatically." actions={<Link to="/admin/experiments/new" className="btn-primary">New experiment</Link>} />
      {exps.isLoading ? <Spinner /> : exps.data?.length ? (
        <>
          <ExperimentTable experiments={exps.data} components={comps.data} />
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {exps.data.map((e) => <li key={e.id}><Link className="btn-secondary btn-sm" to={`/admin/experiments/${e.id}`}>Edit {e.code}</Link></li>)}
          </ul>
        </>
      ) : (
        <EmptyState title="No experiment records yet" action={<Link to="/admin/experiments/new" className="btn-primary btn-sm">Create one</Link>} />
      )}
    </>
  );
}

type MetricDraft = Partial<ExperimentMetric> & { _key: string };

function MetricsEditor({ experimentId }: { experimentId: string }) {
  const qc = useQueryClient();
  const metrics = useMetrics([experimentId]);
  const [rows, setRows] = useState<MetricDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (metrics.data) setRows(metrics.data.map((m) => ({ ...m, _key: m.id })));
  }, [metrics.data]);

  const upd = (key: string, patch: Partial<ExperimentMetric>) => {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };
  const add = () => setRows((rs) => [...rs, { _key: crypto.randomUUID(), metric_name: '', condition_label: '', value: null, unit: '', split: '', higher_is_better: null, is_baseline: false, notes: '', sort_order: rs.length * 10 }]);

  const saveAll = async () => {
    setBusy(true);
    setErr(null);
    try {
      const keep = rows.filter((r) => r.metric_name?.trim());
      const existing = new Set((metrics.data ?? []).map((m) => m.id));
      const removed = [...existing].filter((id) => !keep.some((r) => r.id === id));
      if (removed.length) {
        const { error } = await supabase.from('experiment_metrics').delete().in('id', removed);
        if (error) throw error;
      }
      for (const [i, r] of keep.entries()) {
        const payload = {
          experiment_id: experimentId,
          metric_name: r.metric_name!.trim(),
          condition_label: r.condition_label ?? '',
          is_baseline: !!r.is_baseline,
          value: r.value === null || r.value === undefined || Number.isNaN(r.value) ? null : Number(r.value),
          unit: r.unit ?? '',
          higher_is_better: r.higher_is_better ?? null,
          split: r.split ?? '',
          notes: r.notes ?? '',
          sort_order: i * 10,
        };
        const { error } = r.id
          ? await supabase.from('experiment_metrics').update(payload).eq('id', r.id)
          : await supabase.from('experiment_metrics').insert(payload);
        if (error) throw error;
      }
      await invalidateAll(qc);
      setSaved(true);
    } catch (e) {
      setErr(friendlyDbError((e as { message?: string }).message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <NoticeBox tone="warning">Enter only measured values from real runs. Record the split, unit and direction so values can be compared correctly.</NoticeBox>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="px-1 py-1">Metric</th><th className="px-1 py-1">Condition / model</th><th className="px-1 py-1">Baseline?</th>
              <th className="px-1 py-1">Value</th><th className="px-1 py-1">Unit</th><th className="px-1 py-1">Better</th><th className="px-1 py-1">Split</th><th className="px-1 py-1">Notes</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._key}>
                <td className="p-1"><input className="input min-w-28" aria-label="Metric name" value={r.metric_name ?? ''} onChange={(e) => upd(r._key, { metric_name: e.target.value })} /></td>
                <td className="p-1"><input className="input min-w-32" aria-label="Condition" value={r.condition_label ?? ''} onChange={(e) => upd(r._key, { condition_label: e.target.value })} /></td>
                <td className="p-1 text-center"><input type="checkbox" aria-label="Is baseline" checked={!!r.is_baseline} onChange={(e) => upd(r._key, { is_baseline: e.target.checked })} /></td>
                <td className="p-1"><input className="input w-28" type="number" step="any" aria-label="Value" value={r.value ?? ''} onChange={(e) => upd(r._key, { value: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                <td className="p-1"><input className="input w-20" aria-label="Unit" value={r.unit ?? ''} onChange={(e) => upd(r._key, { unit: e.target.value })} /></td>
                <td className="p-1">
                  <select className="input w-24" aria-label="Direction" value={r.higher_is_better === null || r.higher_is_better === undefined ? '' : r.higher_is_better ? 'up' : 'down'} onChange={(e) => upd(r._key, { higher_is_better: e.target.value === '' ? null : e.target.value === 'up' })}>
                    <option value="">—</option><option value="up">Higher</option><option value="down">Lower</option>
                  </select>
                </td>
                <td className="p-1"><input className="input w-24" aria-label="Split" value={r.split ?? ''} onChange={(e) => upd(r._key, { split: e.target.value })} /></td>
                <td className="p-1"><input className="input min-w-32" aria-label="Notes" value={r.notes ?? ''} onChange={(e) => upd(r._key, { notes: e.target.value })} /></td>
                <td className="p-1"><button type="button" className="btn-danger btn-sm" onClick={() => setRows((rs) => rs.filter((x) => x._key !== r._key))} aria-label="Remove metric">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={add}>Add metric row</button>
        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => void saveAll()}>{busy ? 'Saving…' : 'Save metrics'}</button>
        {saved && <span className="text-xs text-emerald-700">Metrics saved</span>}
        {err && <span className="text-xs text-red-700">{err}</span>}
      </div>
    </div>
  );
}

function WeekLinks({ experimentId }: { experimentId: string }) {
  const qc = useQueryClient();
  const weeks = useWeeklyUpdates();
  const links = useWeeklyExperimentLinks();
  const on = new Set((links.data ?? []).filter((l) => l.experiment_id === experimentId).map((l) => l.weekly_update_id));
  const toggle = async (wid: string) => {
    if (on.has(wid)) await supabase.from('weekly_update_experiments').delete().eq('weekly_update_id', wid).eq('experiment_id', experimentId);
    else await supabase.from('weekly_update_experiments').insert({ weekly_update_id: wid, experiment_id: experimentId });
    await invalidateAll(qc);
  };
  if (!weeks.data?.length) return <p className="text-sm text-slate-500">No weekly updates exist yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {weeks.data.map((w) => (
        <button key={w.id} type="button" aria-pressed={on.has(w.id)} onClick={() => void toggle(w.id)} className={`rounded-full border px-2.5 py-1 text-xs ${on.has(w.id) ? 'border-accent-700 bg-accent-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
          {formatDate(w.week_start)}
        </button>
      ))}
    </div>
  );
}

export function ExperimentEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const exps = useExperiments();
  const comps = useModelComponents();
  const f = useEntityForm<Experiment>('experiments', id, {
    code: '', name: '', status: 'planned', model_component_id: params.get('component'), experiment_date: null, published: true,
    research_question: '', hypothesis: '', dataset: '', model_checkpoint: '', config_md: '', baseline_md: '', observations_md: '', conclusions_md: '', limitations_md: '',
  });
  const e = f.row;

  useEffect(() => {
    if (f.isNew && !e.code && exps.data) f.set('code', nextExperimentCode(exps.data.map((x) => x.code)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exps.data]);

  if (f.loading) return <Spinner />;
  if (!f.isNew && !e.id) return <ErrorBox error={f.error ?? 'Not found'} />;

  const save = async () => {
    if (!e.name?.trim()) return f.setError('Give the experiment a name.');
    if (!e.code || !isValidExperimentCode(e.code)) return f.setError('Experiment ID may contain letters, digits, ".", "_" and "-" only.');
    const r = await f.save();
    if (r && f.isNew) {
      const week = params.get('week');
      if (week) {
        await supabase.from('weekly_update_experiments').insert({ weekly_update_id: week, experiment_id: r.id });
        await invalidateAll(qc);
      }
      navigate(`/admin/experiments/${r.id}`, { replace: true });
    }
  };

  const remove = async () => {
    if (!confirm(`Delete experiment ${e.code}? Its metrics and weekly links are deleted; uploaded files are kept in the library.`)) return;
    const { error } = await supabase.from('experiments').delete().eq('id', e.id!);
    if (error) return f.setError(friendlyDbError(error.message));
    await invalidateAll(qc);
    navigate('/admin/experiments', { replace: true });
  };

  const md = (k: keyof Experiment, label: string, rows = 4) => (
    <MarkdownField id={String(k)} label={label} rows={rows} folder={`experiments/${e.code || 'new'}`} value={String(e[k] ?? '')} onChange={(v) => f.set(k, v as never)} />
  );

  return (
    <>
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Experiments', to: '/admin/experiments' }, { label: f.isNew ? 'New' : e.code! }]} />
      <PageHeader title={f.isNew ? 'New experiment record' : `${e.code} — ${e.name}`} actions={!f.isNew && <Link className="btn-secondary" to={`/experiments/${encodeURIComponent(e.code!)}`}>View record</Link>} />
      <div className="space-y-6">
        <FormCard title="Identity">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Experiment ID" htmlFor="code" help="Stable identifier; avoid renaming once referenced."><TextInput id="code" value={e.code} onChange={(v) => f.set('code', v.trim())} /></Field>
            <Field label="Name" htmlFor="name" className="md:col-span-3"><TextInput id="name" value={e.name} onChange={(v) => f.set('name', v)} /></Field>
            <Field label="Model component" htmlFor="comp" className="md:col-span-2">
              <select id="comp" className="input" value={e.model_component_id ?? ''} onChange={(ev) => f.set('model_component_id', ev.target.value || null)}>
                <option value="">— none —</option>
                {(comps.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
            <Field label="Date" htmlFor="date"><input id="date" type="date" className="input" value={e.experiment_date ?? ''} onChange={(ev) => f.set('experiment_date', ev.target.value || null)} /></Field>
            <Field label="Status" htmlFor="status"><Select<ExperimentStatus> id="status" value={e.status ?? 'planned'} onChange={(v) => f.set('status', v)} options={Object.entries(experimentStatusLabel) as [ExperimentStatus, string][]} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!e.published} onChange={(ev) => f.set('published', ev.target.checked)} /> Ready to show (unchecked = draft badge)</label>
        </FormCard>
        <FormCard title="Design">
          <Field label="Research question" htmlFor="rq"><TextInput id="rq" value={e.research_question} onChange={(v) => f.set('research_question', v)} /></Field>
          <Field label="Hypothesis" htmlFor="hyp"><TextInput id="hyp" value={e.hypothesis} onChange={(v) => f.set('hypothesis', v)} /></Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Dataset / split" htmlFor="ds"><TextInput id="ds" value={e.dataset} onChange={(v) => f.set('dataset', v)} /></Field>
            <Field label="Model / checkpoint" htmlFor="ckpt"><TextInput id="ckpt" value={e.model_checkpoint} onChange={(v) => f.set('model_checkpoint', v)} /></Field>
          </div>
          {md('config_md', 'Configuration (commit, config path, seed, hardware, …)', 5)}
          {md('baseline_md', 'Baseline comparisons')}
        </FormCard>
        {!f.isNew && (
          <>
            <FormCard title="Evaluation metrics"><MetricsEditor experimentId={e.id!} /></FormCard>
            <FormCard title="Figures, audio and video">
              <AttachmentsEditor entityType="experiment" entityId={e.id} folder={`experiments/${e.code}`} roles={['figure', 'audio', 'video', 'comparison', 'diagram', 'data', 'attachment']} />
            </FormCard>
          </>
        )}
        <FormCard title="Findings">
          {md('observations_md', 'Observations')}
          {md('conclusions_md', 'Conclusions')}
          {md('limitations_md', 'Limitations')}
        </FormCard>
        {!f.isNew && <FormCard title="Related weekly updates"><WeekLinks experimentId={e.id!} /></FormCard>}
        {f.isNew && <p className="text-sm text-slate-500">Save the record to add metrics, files and weekly links.</p>}
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} error={f.error} savedAt={f.savedAt}>
        {!f.isNew && <button type="button" className="btn-danger" onClick={() => void remove()}>Delete</button>}
        <button type="button" className="btn-primary" disabled={f.saving} onClick={() => void save()}>{f.isNew ? 'Create record' : 'Save'}</button>
      </SaveBar>
    </>
  );
}
