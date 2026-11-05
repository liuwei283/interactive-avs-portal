import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invalidateAll, useMilestones } from '../../lib/api';
import { isValidSlug, slugify } from '../../lib/slug';
import type { Milestone } from '../../lib/types';
import { PageHeader, Spinner } from '../../components/ui';
import { Field, TextInput } from '../../components/admin/Field';
import { MarkdownField } from '../../components/admin/MarkdownField';
import { friendlyDbError } from '../../components/admin/useEntityForm';

function MilestoneCard({ m, onDone }: { m: Partial<Milestone>; onDone: () => Promise<unknown> }) {
  const [d, setD] = useState(m);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const save = async () => {
    setErr(null);
    const slug = d.slug || slugify(`${d.phase ?? ''} ${d.title ?? ''}`);
    if (!d.title || !isValidSlug(slug)) return setErr('Title is required.');
    const payload = { slug, phase: d.phase ?? '', title: d.title, description_md: d.description_md ?? '', evidence_md: d.evidence_md ?? '', target_date: d.target_date || null, status: d.status ?? 'planned', sort_order: d.sort_order ?? 0 };
    const res = d.id ? await supabase.from('milestones').update(payload).eq('id', d.id) : await supabase.from('milestones').insert(payload);
    if (res.error) return setErr(friendlyDbError(res.error.message));
    setOk(true);
    if (!d.id) setD({ sort_order: (d.sort_order ?? 0) + 10, status: 'planned' });
    await onDone();
  };
  const del = async () => {
    if (!d.id || !confirm(`Delete milestone "${d.title}"?`)) return;
    const { error } = await supabase.from('milestones').delete().eq('id', d.id);
    if (error) return setErr(friendlyDbError(error.message));
    await onDone();
  };
  return (
    <div className="card p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <Field label="Phase" htmlFor={`p-${m.id}`}><TextInput id={`p-${m.id}`} value={d.phase} onChange={(v) => setD({ ...d, phase: v })} placeholder="Q1" /></Field>
        <Field label="Title" htmlFor={`t-${m.id}`} className="md:col-span-3"><TextInput id={`t-${m.id}`} value={d.title} onChange={(v) => setD({ ...d, title: v })} /></Field>
        <Field label="Status" htmlFor={`s-${m.id}`}>
          <select id={`s-${m.id}`} className="input" value={d.status ?? 'planned'} onChange={(e) => setD({ ...d, status: e.target.value as Milestone['status'] })}>
            {['planned', 'active', 'done', 'deferred'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Target date" htmlFor={`d-${m.id}`}><input id={`d-${m.id}`} type="date" className="input" value={d.target_date ?? ''} onChange={(e) => setD({ ...d, target_date: e.target.value || null })} /></Field>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <MarkdownField id={`desc-${m.id}`} label="Goal" rows={3} value={d.description_md ?? ''} onChange={(v) => setD({ ...d, description_md: v })} />
        <MarkdownField id={`ev-${m.id}`} label="Evidence that would establish progress" rows={3} value={d.evidence_md ?? ''} onChange={(v) => setD({ ...d, evidence_md: v })} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={() => void save()}>{d.id ? 'Save' : 'Add milestone'}</button>
        {d.id && <button type="button" className="btn-danger btn-sm" onClick={() => void del()}>Delete</button>}
        <label className="ml-2 text-xs text-slate-500">Order <input type="number" className="input inline-block w-20" value={d.sort_order ?? 0} onChange={(e) => setD({ ...d, sort_order: Number(e.target.value) || 0 })} /></label>
        {ok && <span className="text-xs text-emerald-700">Saved</span>}
        {err && <span className="text-xs text-red-700">{err}</span>}
      </div>
    </div>
  );
}

export default function MilestonesAdmin() {
  const qc = useQueryClient();
  const ms = useMilestones();
  const refresh = () => invalidateAll(qc);
  return (
    <>
      <PageHeader title="Milestones" description="Proposal quarters are relative. Add a target date only when the team has agreed on one." />
      {ms.isLoading ? <Spinner /> : (
        <div className="space-y-4">
          {(ms.data ?? []).map((m) => <MilestoneCard key={m.id + m.updated_at} m={m} onDone={refresh} />)}
          <h2 className="pt-4 text-sm font-semibold text-slate-700">New milestone</h2>
          <MilestoneCard m={{ status: 'planned', sort_order: ((ms.data?.length ?? 0) + 1) * 10 }} onDone={refresh} />
        </div>
      )}
    </>
  );
}
