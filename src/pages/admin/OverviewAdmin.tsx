import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invalidateAll, useAsset, useSurveyCategories, useThrusts } from '../../lib/api';
import { isValidSlug, slugify } from '../../lib/slug';
import type { ResearchThrust, SiteSettings, SurveyCategory } from '../../lib/types';
import { ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { Field, FormCard, TextInput } from '../../components/admin/Field';
import { MarkdownField } from '../../components/admin/MarkdownField';
import { AssetPicker } from '../../components/admin/AssetPicker';
import { SaveBar } from '../../components/admin/SaveBar';
import { friendlyDbError, useEntityForm } from '../../components/admin/useEntityForm';

function ThrustCard({ t, onDone }: { t: Partial<ResearchThrust>; onDone: () => Promise<unknown> }) {
  const [d, setD] = useState(t);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const save = async () => {
    setErr(null);
    const slug = d.slug || slugify(d.title ?? '');
    if (!d.title || !isValidSlug(slug)) return setErr('Title and a valid slug are required.');
    const payload = { slug, numeral: d.numeral ?? '', title: d.title, summary_md: d.summary_md ?? '', formulation_md: d.formulation_md ?? '', sort_order: d.sort_order ?? 0 };
    const res = d.id ? await supabase.from('research_thrusts').update(payload).eq('id', d.id) : await supabase.from('research_thrusts').insert(payload);
    if (res.error) return setErr(friendlyDbError(res.error.message));
    setOk(true);
    await onDone();
  };
  const del = async () => {
    if (!d.id || !confirm(`Delete thrust "${d.title}"? Its components become unassigned.`)) return;
    const { error } = await supabase.from('research_thrusts').delete().eq('id', d.id);
    if (error) return setErr(friendlyDbError(error.message));
    await onDone();
  };
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <Field label="Part" htmlFor={`n-${t.id}`}><TextInput id={`n-${t.id}`} value={d.numeral} onChange={(v) => setD({ ...d, numeral: v })} placeholder="I" /></Field>
        <Field label="Title" htmlFor={`t-${t.id}`} className="md:col-span-3"><TextInput id={`t-${t.id}`} value={d.title} onChange={(v) => setD({ ...d, title: v })} /></Field>
        <Field label="Slug" htmlFor={`s-${t.id}`}><TextInput id={`s-${t.id}`} value={d.slug} onChange={(v) => setD({ ...d, slug: v.toLowerCase() })} placeholder={slugify(d.title ?? '')} /></Field>
        <Field label="Order" htmlFor={`o-${t.id}`}><TextInput id={`o-${t.id}`} type="number" value={d.sort_order} onChange={(v) => setD({ ...d, sort_order: Number(v) || 0 })} /></Field>
      </div>
      <div className="mt-3 space-y-3">
        <MarkdownField id={`sum-${t.id}`} label="Summary" rows={3} value={d.summary_md ?? ''} onChange={(v) => setD({ ...d, summary_md: v })} />
        <MarkdownField id={`f-${t.id}`} label="Formulation" rows={3} value={d.formulation_md ?? ''} onChange={(v) => setD({ ...d, formulation_md: v })} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={() => void save()}>{d.id ? 'Save thrust' : 'Add thrust'}</button>
        {d.id && <button type="button" className="btn-danger btn-sm" onClick={() => void del()}>Delete</button>}
        {ok && <span className="text-xs text-emerald-700">Saved</span>}
        {err && <span className="text-xs text-red-700">{err}</span>}
      </div>
    </div>
  );
}

function CategoryRow({ c, onDone }: { c: Partial<SurveyCategory> & { _new?: boolean }; onDone: () => Promise<unknown> }) {
  const [d, setD] = useState(c);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const slug = d.slug || slugify(d.title ?? '');
    if (!d.title || !isValidSlug(slug)) return setErr('Title and valid slug required');
    const payload = { slug, title: d.title, description: d.description ?? '', sort_order: d.sort_order ?? 0 };
    const res = c._new ? await supabase.from('survey_categories').insert(payload) : await supabase.from('survey_categories').update(payload).eq('slug', c.slug!);
    if (res.error) return setErr(friendlyDbError(res.error.message));
    setErr(null);
    if (c._new) setD({ title: '', slug: '', description: '', sort_order: 0 });
    await onDone();
  };
  const del = async () => {
    if (!confirm(`Delete category "${c.title}"? Papers keep their other categories.`)) return;
    const { error } = await supabase.from('survey_categories').delete().eq('slug', c.slug!);
    if (error) return setErr(friendlyDbError(error.message));
    await onDone();
  };
  return (
    <tr>
      <td className="p-1"><input className="input" aria-label="Category title" value={d.title ?? ''} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder={c._new ? 'New category' : ''} /></td>
      <td className="p-1"><input className="input" aria-label="Category slug" value={d.slug ?? ''} onChange={(e) => setD({ ...d, slug: e.target.value.toLowerCase() })} placeholder={slugify(d.title ?? '')} /></td>
      <td className="p-1"><input className="input" aria-label="Category description" value={d.description ?? ''} onChange={(e) => setD({ ...d, description: e.target.value })} /></td>
      <td className="p-1"><input className="input w-20" type="number" aria-label="Order" value={d.sort_order ?? 0} onChange={(e) => setD({ ...d, sort_order: Number(e.target.value) || 0 })} /></td>
      <td className="p-1 whitespace-nowrap">
        <button type="button" className="btn-secondary btn-sm" onClick={() => void save()}>{c._new ? 'Add' : 'Save'}</button>
        {!c._new && <button type="button" className="btn-danger btn-sm ml-1" onClick={() => void del()}>✕</button>}
        {err && <div className="text-xs text-red-700">{err}</div>}
      </td>
    </tr>
  );
}

function ArchitecturePicker({ id, onChange }: { id: string | null | undefined; onChange: (id: string | null) => void }) {
  const a = useAsset(id);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-700">{id ? a.data?.filename ?? '…' : 'No diagram selected'}</span>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>{id ? 'Change' : 'Choose / upload'}</button>
      {id && <button type="button" className="btn-secondary btn-sm" onClick={() => onChange(null)}>Remove</button>}
      {open && <AssetPicker kinds={['image', 'svg']} folder="overview" title="Architecture diagram" onClose={() => setOpen(false)} onPick={(x) => { setOpen(false); onChange(x.id); }} />}
    </div>
  );
}

export default function OverviewAdmin() {
  const qc = useQueryClient();
  const f = useEntityForm<Omit<SiteSettings, 'id'> & { id?: string }>('site_settings', '1', {});
  const thrusts = useThrusts();
  const cats = useSurveyCategories();
  const refresh = () => invalidateAll(qc);
  const s = f.row;
  if (f.loading) return <Spinner />;
  if (f.error && s.id === undefined) return <ErrorBox error={f.error} />;

  const md = (k: Exclude<keyof SiteSettings, 'id'>, label: string, rows = 5) => (
    <MarkdownField id={String(k)} label={label} rows={rows} folder="overview" value={String(s[k] ?? '')} onChange={(v) => f.set(k, v as never)} />
  );

  return (
    <>
      <PageHeader title="Overview content & research thrusts" description="Project-level content shown on the Overview page and used to organize Models and Survey. Keep it consistent with PROJECT_CONTEXT.md." />
      <div className="space-y-6">
        <FormCard title="Project identity">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Project title" htmlFor="pt"><TextInput id="pt" value={s.project_title} onChange={(v) => f.set('project_title', v)} /></Field>
            <Field label="Short title (header)" htmlFor="st"><TextInput id="st" value={s.short_title} onChange={(v) => f.set('short_title', v)} /></Field>
            <Field label="Affiliation" htmlFor="af"><TextInput id="af" value={s.affiliation} onChange={(v) => f.set('affiliation', v)} /></Field>
            <Field label="Collaboration line" htmlFor="co" help="Do not imply endorsement beyond what has been approved."><TextInput id="co" value={s.collaboration} onChange={(v) => f.set('collaboration', v)} /></Field>
          </div>
          {md('team_md', 'Team', 3)}
        </FormCard>
        <FormCard title="Motivation and objectives">
          {md('motivation_md', 'Motivation', 8)}
          {md('hypothesis_md', 'Central hypothesis', 3)}
          {md('objectives_md', 'Objectives', 6)}
        </FormCard>
        <FormCard title="Architecture">
          {md('architecture_md', 'Architecture description', 5)}
          <Field label="Architecture diagram"><ArchitecturePicker id={s.architecture_asset_id} onChange={(v) => f.set('architecture_asset_id', v)} /></Field>
        </FormCard>
        <FormCard title="Research thrusts" description="Each thrust becomes a section on the Models page.">
          {thrusts.isLoading ? <Spinner /> : (
            <div className="space-y-4">
              {(thrusts.data ?? []).map((t) => <ThrustCard key={t.id + t.updated_at} t={t} onDone={refresh} />)}
              <details className="rounded-md border border-dashed border-slate-300 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Add a thrust</summary>
                <div className="mt-3"><ThrustCard t={{ sort_order: (thrusts.data?.length ?? 0) * 10 + 10 }} onDone={refresh} /></div>
              </details>
            </div>
          )}
        </FormCard>
        <FormCard title="Survey categories">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="p-1">Title</th><th className="p-1">Slug</th><th className="p-1">Description</th><th className="p-1">Order</th><th /></tr></thead>
              <tbody>
                {(cats.data ?? []).map((c) => <CategoryRow key={c.slug + c.title + c.sort_order} c={c} onDone={refresh} />)}
                <CategoryRow c={{ _new: true, sort_order: ((cats.data?.length ?? 0) + 1) * 10 }} onDone={refresh} />
              </tbody>
            </table>
          </div>
        </FormCard>
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} error={f.error} savedAt={f.savedAt}>
        <button type="button" className="btn-primary" disabled={f.saving} onClick={() => void f.save()}>Save overview</button>
      </SaveBar>
    </>
  );
}
