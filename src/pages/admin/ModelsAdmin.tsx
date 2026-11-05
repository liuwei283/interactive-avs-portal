import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invalidateAll, useModelComponents, useThrusts } from '../../lib/api';
import { componentStatusLabel } from '../../lib/labels';
import { isValidSlug, slugify } from '../../lib/slug';
import type { ComponentStatus, ModelComponent } from '../../lib/types';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { EmptyState, ErrorBox, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import { Field, FormCard, Select, TextInput } from '../../components/admin/Field';
import { MarkdownField } from '../../components/admin/MarkdownField';
import { AttachmentsEditor } from '../../components/admin/AttachmentsEditor';
import { SaveBar } from '../../components/admin/SaveBar';
import { friendlyDbError, useEntityForm } from '../../components/admin/useEntityForm';

export default function ModelsAdmin() {
  const comps = useModelComponents();
  const thrusts = useThrusts();
  return (
    <>
      <PageHeader title="Model components" description="Components are grouped by research thrust. Add new components at any time; pages are generated from this template." actions={<Link to="/admin/models/new" className="btn-primary">New component</Link>} />
      {comps.isLoading ? <Spinner /> : !comps.data?.length ? <EmptyState title="No components yet" /> : (
        <div className="space-y-6">
          {[...(thrusts.data ?? []), null].map((t) => {
            const cs = comps.data!.filter((c) => (t ? c.thrust_id === t.id : !c.thrust_id));
            if (!cs.length) return null;
            return (
              <section key={t?.id ?? 'none'}>
                <h2 className="eyebrow mb-2">{t ? `Part ${t.numeral} — ${t.title}` : 'No thrust'}</h2>
                <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {cs.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <Link to={`/admin/models/${c.id}`} className="font-medium text-slate-800 hover:underline">{c.title}</Link>
                      <span className="flex items-center gap-2"><StatusBadge status={c.status} label={componentStatusLabel[c.status]} /><Link to={`/models/${c.slug}`} className="btn-secondary btn-sm">View</Link></span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

export function ModelEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const thrusts = useThrusts();
  const f = useEntityForm<ModelComponent>('model_components', id, {
    title: '', slug: '', summary: '', status: 'planned', thrust_id: null, sort_order: 100, published: true,
    overview_md: '', motivation_md: '', architecture_md: '', implementation_md: '', training_config_md: '', results_md: '', limitations_md: '', planned_md: '',
  });
  const c = f.row;
  if (f.loading) return <Spinner />;
  if (!f.isNew && !c.id) return <ErrorBox error={f.error ?? 'Not found'} />;

  const save = async () => {
    if (!c.title?.trim()) return f.setError('Title is required.');
    const slug = c.slug || slugify(c.title);
    if (!isValidSlug(slug)) return f.setError('URL slug may contain lowercase letters, digits and dashes only.');
    const r = await f.save({ slug });
    if (r && f.isNew) navigate(`/admin/models/${r.id}`, { replace: true });
  };
  const remove = async () => {
    if (!confirm(`Delete component "${c.title}"? Its experiments are kept but become unassigned.`)) return;
    const { error } = await supabase.from('model_components').delete().eq('id', c.id!);
    if (error) return f.setError(friendlyDbError(error.message));
    await invalidateAll(qc);
    navigate('/admin/models', { replace: true });
  };
  const md = (k: keyof ModelComponent, label: string, rows = 5, help?: string) => (
    <MarkdownField id={String(k)} label={label} rows={rows} help={help} folder={`models/${c.slug || 'new'}`} value={String(c[k] ?? '')} onChange={(v) => f.set(k, v as never)} />
  );

  return (
    <>
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Model components', to: '/admin/models' }, { label: f.isNew ? 'New' : c.title! }]} />
      <PageHeader title={f.isNew ? 'New model component' : c.title!} actions={!f.isNew && <Link to={`/models/${c.slug}`} className="btn-secondary">View page</Link>} />
      <div className="space-y-6">
        <FormCard title="Basics">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Title" htmlFor="title" className="md:col-span-2"><TextInput id="title" value={c.title} onChange={(v) => f.set('title', v)} /></Field>
            <Field label="URL slug" htmlFor="slug" help={`/models/${c.slug || slugify(c.title ?? '') || '…'}`}><TextInput id="slug" value={c.slug} placeholder={slugify(c.title ?? '')} onChange={(v) => f.set('slug', v.toLowerCase())} /></Field>
            <Field label="Research thrust" htmlFor="thrust">
              <select id="thrust" className="input" value={c.thrust_id ?? ''} onChange={(e) => f.set('thrust_id', e.target.value || null)}>
                <option value="">— none —</option>
                {(thrusts.data ?? []).map((t) => <option key={t.id} value={t.id}>Part {t.numeral} — {t.title}</option>)}
              </select>
            </Field>
            <Field label="Status" htmlFor="status"><Select<ComponentStatus> id="status" value={c.status ?? 'planned'} onChange={(v) => f.set('status', v)} options={Object.entries(componentStatusLabel) as [ComponentStatus, string][]} /></Field>
            <Field label="Sort order" htmlFor="order"><TextInput id="order" type="number" value={c.sort_order} onChange={(v) => f.set('sort_order', Number(v) || 0)} /></Field>
          </div>
          <Field label="One-line summary" htmlFor="summary"><TextInput id="summary" value={c.summary} onChange={(v) => f.set('summary', v)} /></Field>
        </FormCard>
        <FormCard title="Design and plan" description="Shown as design/plan content, visually separate from recorded evidence.">
          {md('overview_md', 'Technical overview', 6)}
          {md('motivation_md', 'Research motivation')}
          {md('architecture_md', 'Architecture', 6, 'Attach diagrams below with role “Architecture diagram”.')}
        </FormCard>
        <FormCard title="Implementation">
          {md('implementation_md', 'Implementation notes', 6)}
          {md('training_config_md', 'Training configuration', 6)}
        </FormCard>
        <FormCard title="Results summary, limitations and plans" description="Per-experiment metrics and demos are pulled in automatically from experiment records.">
          {md('results_md', 'Results commentary (optional)')}
          {md('limitations_md', 'Known limitations')}
          {md('planned_md', 'Planned improvements')}
        </FormCard>
        {!f.isNew && (
          <FormCard title="Diagrams, visualizations and demos">
            <AttachmentsEditor entityType="model_component" entityId={c.id} folder={`models/${c.slug}`} roles={['diagram', 'figure', 'audio', 'video', 'comparison', 'attachment']} />
          </FormCard>
        )}
      </div>
      <SaveBar dirty={f.dirty} saving={f.saving} error={f.error} savedAt={f.savedAt}>
        {!f.isNew && <button type="button" className="btn-danger" onClick={() => void remove()}>Delete</button>}
        <button type="button" className="btn-primary" disabled={f.saving} onClick={() => void save()}>{f.isNew ? 'Create component' : 'Save'}</button>
      </SaveBar>
    </>
  );
}
