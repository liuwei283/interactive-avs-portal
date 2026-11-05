import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invalidateAll, usePapers, useSurveyCategories } from '../../lib/api';
import { publicationStatusLabel, readingStatusLabel } from '../../lib/labels';
import { isValidSlug, parseTags, slugify } from '../../lib/slug';
import type { Paper, PublicationStatus, ReadingStatus } from '../../lib/types';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { EmptyState, ErrorBox, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import { Field, FormCard, Select, TextInput } from '../../components/admin/Field';
import { MarkdownField } from '../../components/admin/MarkdownField';
import { SaveBar } from '../../components/admin/SaveBar';
import { friendlyDbError, useEntityForm } from '../../components/admin/useEntityForm';

export default function PapersAdmin() {
  const papers = usePapers();
  const [q, setQ] = useState('');
  const list = (papers.data ?? []).filter((p) => !q || `${p.title} ${p.authors}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Survey papers" actions={<Link to="/admin/papers/new" className="btn-primary">Add paper</Link>} />
      <input className="input mb-3 max-w-md" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter papers" />
      {papers.isLoading ? <Spinner /> : !list.length ? <EmptyState title="No papers" /> : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <Link to={`/admin/papers/${p.id}`} className="font-medium text-slate-800 hover:underline">{p.title}</Link>
                <div className="truncate text-xs text-slate-500">{[p.venue, p.year].filter(Boolean).join(' ')}</div>
              </div>
              <StatusBadge status={p.reading_status} label={readingStatusLabel[p.reading_status]} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function PaperEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cats = useSurveyCategories();
  const f = useEntityForm<Paper>('papers', id, {
    title: '', slug: '', authors: '', venue: '', year: null, publication_status: 'published', paper_url: '', project_url: '', code_url: '',
    tags: [], summary_md: '', contributions_md: '', relevance_md: '', notes_md: '', reading_status: 'to_read', team_prior_work: false, source_note: '', published: true,
  });
  const [selected, setSelected] = useState<string[] | null>(null);
  const [origCats, setOrigCats] = useState<string[]>([]);
  const [tagText, setTagText] = useState<string | null>(null);
  const p = f.row;

  useEffect(() => {
    if (!p.id) return;
    supabase.from('paper_category_links').select('category_slug').eq('paper_id', p.id).then(({ data }) => {
      const slugs = (data ?? []).map((r: { category_slug: string }) => r.category_slug);
      setSelected(slugs);
      setOrigCats(slugs);
    });
  }, [p.id]);

  if (f.loading) return <Spinner />;
  if (!f.isNew && !p.id) return <ErrorBox error={f.error ?? 'Not found'} />;
  const chosen = selected ?? [];

  const save = async () => {
    if (!p.title?.trim()) return f.setError('Title is required.');
    const slug = p.slug || slugify(p.title);
    if (!isValidSlug(slug)) return f.setError('URL slug may contain lowercase letters, digits and dashes only.');
    for (const u of [p.paper_url, p.project_url, p.code_url]) if (u && !/^https?:\/\//i.test(u)) return f.setError('Links must start with http:// or https://');
    const r = await f.save({ slug, tags: tagText !== null ? parseTags(tagText) : p.tags });
    if (!r) return;
    const { error: delErr } = await supabase.from('paper_category_links').delete().eq('paper_id', r.id);
    if (delErr) return f.setError(friendlyDbError(delErr.message));
    if (chosen.length) {
      const { error } = await supabase.from('paper_category_links').insert(chosen.map((c) => ({ paper_id: r.id, category_slug: c })));
      if (error) return f.setError(friendlyDbError(error.message));
    }
    setTagText(null);
    setOrigCats(chosen);
    await invalidateAll(qc);
    if (f.isNew) navigate(`/admin/papers/${r.id}`, { replace: true });
  };
  const remove = async () => {
    if (!confirm(`Delete "${p.title}" from the survey?`)) return;
    const { error } = await supabase.from('papers').delete().eq('id', p.id!);
    if (error) return f.setError(friendlyDbError(error.message));
    await invalidateAll(qc);
    navigate('/admin/papers', { replace: true });
  };
  const md = (k: keyof Paper, label: string, help?: string) => (
    <MarkdownField id={String(k)} label={label} rows={4} help={help} folder="papers" value={String(p[k] ?? '')} onChange={(v) => f.set(k, v as never)} />
  );

  return (
    <>
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Survey papers', to: '/admin/papers' }, { label: f.isNew ? 'New' : p.title! }]} />
      <PageHeader title={f.isNew ? 'Add paper' : p.title!} description="Enter metadata exactly as published; leave unknown fields empty rather than guessing." actions={!f.isNew && <Link to={`/survey/${p.slug}`} className="btn-secondary">View</Link>} />
      <div className="space-y-6">
        <FormCard title="Bibliographic metadata">
          <Field label="Title" htmlFor="title"><TextInput id="title" value={p.title} onChange={(v) => f.set('title', v)} /></Field>
          <Field label="Authors" htmlFor="authors" help="As listed on the paper, comma-separated."><TextInput id="authors" value={p.authors} onChange={(v) => f.set('authors', v)} /></Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Venue" htmlFor="venue" className="md:col-span-2"><TextInput id="venue" value={p.venue} onChange={(v) => f.set('venue', v)} /></Field>
            <Field label="Year" htmlFor="year"><TextInput id="year" type="number" value={p.year ?? ''} onChange={(v) => f.set('year', v ? Number(v) : null)} /></Field>
            <Field label="Publication status" htmlFor="pub"><Select<PublicationStatus> id="pub" value={p.publication_status ?? 'published'} onChange={(v) => f.set('publication_status', v)} options={Object.entries(publicationStatusLabel) as [PublicationStatus, string][]} /></Field>
            <Field label="Paper URL" htmlFor="purl" className="md:col-span-2"><TextInput id="purl" value={p.paper_url} onChange={(v) => f.set('paper_url', v.trim())} placeholder="https://" /></Field>
            <Field label="Project URL" htmlFor="prurl"><TextInput id="prurl" value={p.project_url} onChange={(v) => f.set('project_url', v.trim())} placeholder="https://" /></Field>
            <Field label="Code URL" htmlFor="curl"><TextInput id="curl" value={p.code_url} onChange={(v) => f.set('code_url', v.trim())} placeholder="https://" /></Field>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="URL slug" htmlFor="slug" help={`/survey/${p.slug || slugify(p.title ?? '') || '…'}`}><TextInput id="slug" value={p.slug} placeholder={slugify(p.title ?? '')} onChange={(v) => f.set('slug', v.toLowerCase())} /></Field>
            <Field label="Reading status" htmlFor="rs"><Select<ReadingStatus> id="rs" value={p.reading_status ?? 'to_read'} onChange={(v) => f.set('reading_status', v)} options={Object.entries(readingStatusLabel) as [ReadingStatus, string][]} /></Field>
            <Field label="Tags" htmlFor="tags" help="Comma-separated"><TextInput id="tags" value={tagText ?? (p.tags ?? []).join(', ')} onChange={setTagText} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!p.team_prior_work} onChange={(e) => f.set('team_prior_work', e.target.checked)} /> Prior work by members of our team</label>
          <Field label="Metadata source" htmlFor="src" help="Where the details came from, e.g. “Proposal reference list [4]; verify before citing”."><TextInput id="src" value={p.source_note} onChange={(v) => f.set('source_note', v)} /></Field>
        </FormCard>
        <FormCard title="Categories">
          <div className="flex flex-wrap gap-1.5">
            {(cats.data ?? []).map((c) => {
              const on = chosen.includes(c.slug);
              return (
                <button key={c.slug} type="button" aria-pressed={on} onClick={() => setSelected(on ? chosen.filter((x) => x !== c.slug) : [...chosen, c.slug])} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-accent-700 bg-accent-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {c.title}
                </button>
              );
            })}
          </div>
          <p className="help">Categories are managed in Admin → Overview & thrusts.</p>
        </FormCard>
        <FormCard title="Reading notes">
          {md('summary_md', 'Short summary')}
          {md('contributions_md', 'Key contributions')}
          {md('relevance_md', 'Relevance to our project')}
          {md('notes_md', 'Personal research notes')}
        </FormCard>
      </div>
      <SaveBar dirty={f.dirty || tagText !== null || [...chosen].sort().join() !== [...origCats].sort().join()} saving={f.saving} error={f.error} savedAt={f.savedAt}>
        {!f.isNew && <button type="button" className="btn-danger" onClick={() => void remove()}>Delete</button>}
        <button type="button" className="btn-primary" disabled={f.saving} onClick={() => void save()}>{f.isNew ? 'Add paper' : 'Save'}</button>
      </SaveBar>
    </>
  );
}
