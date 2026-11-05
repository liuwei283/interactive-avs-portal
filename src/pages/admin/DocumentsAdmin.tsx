import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invalidateAll, useAsset, useDocuments, useDocumentVersions, useThrusts, useWeeklyUpdates } from '../../lib/api';
import { documentCategoryLabel } from '../../lib/labels';
import { isValidSlug, parseTags, slugify } from '../../lib/slug';
import { formatDate } from '../../lib/dates';
import { formatBytes } from '../../lib/files';
import type { Asset, DocumentCategory, DocumentRow } from '../../lib/types';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { EmptyState, ErrorBox, NoticeBox, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import { Field, FormCard, Select, TextInput } from '../../components/admin/Field';
import { MarkdownField } from '../../components/admin/MarkdownField';
import { FileDropzone } from '../../components/admin/FileDropzone';
import { SaveBar } from '../../components/admin/SaveBar';
import { friendlyDbError, useEntityForm } from '../../components/admin/useEntityForm';

export default function DocumentsAdmin() {
  const docs = useDocuments();
  return (
    <>
      <PageHeader title="Documents" actions={<Link to="/admin/documents/new" className="btn-primary">Upload document</Link>} />
      {docs.isLoading ? <Spinner /> : !docs.data?.length ? <EmptyState title="No documents yet" action={<Link to="/admin/documents/new" className="btn-primary btn-sm">Upload one</Link>} /> : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {docs.data.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div>
                <Link to={`/admin/documents/${d.id}`} className="font-medium text-slate-800 hover:underline">{d.title}</Link>
                <span className="ml-2 text-xs text-slate-500">{documentCategoryLabel[d.category]} · {d.version}</span>
              </div>
              <span className="flex items-center gap-2">{!d.published && <StatusBadge status="draft" />}<Link to={`/documents/${d.slug}`} className="btn-secondary btn-sm">View</Link></span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CurrentFile({ id, label }: { id: string | null | undefined; label: string }) {
  const a = useAsset(id);
  if (!id) return <p className="text-sm text-slate-500">{label}: none</p>;
  return <p className="text-sm text-slate-700">{label}: <span className="font-medium">{a.data?.filename ?? '…'}</span>{a.data && <span className="text-slate-500"> · {formatBytes(a.data.size_bytes)} · uploaded {formatDate(a.data.updated_at)}</span>}</p>;
}

export function DocumentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const thrusts = useThrusts();
  const weeks = useWeeklyUpdates();
  const f = useEntityForm<DocumentRow>('documents', id, {
    title: '', slug: '', description: '', category: 'other', version: 'v1', tags: [], document_date: null, thrust_id: null,
    weekly_update_id: null, file_asset_id: null, preview_asset_id: null, body_md: '', important: false, published: true,
  });
  const versions = useDocumentVersions(f.row.id);
  const [tagText, setTagText] = useState<string | null>(null);
  const [replaceVersion, setReplaceVersion] = useState('');
  const [replaceNote, setReplaceNote] = useState('');
  const d = f.row;
  if (f.loading) return <Spinner />;
  if (!f.isNew && !d.id) return <ErrorBox error={f.error ?? 'Not found'} />;

  const save = async (patch: Partial<DocumentRow> = {}) => {
    if (!d.title?.trim()) return f.setError('Title is required.');
    const slug = d.slug || slugify(d.title);
    if (!isValidSlug(slug)) return f.setError('URL slug may contain lowercase letters, digits and dashes only.');
    const tags = tagText !== null ? parseTags(tagText) : d.tags;
    const r = await f.save({ slug, tags, ...patch });
    if (r && f.isNew) navigate(`/admin/documents/${r.id}`, { replace: true });
    return r;
  };

  /** Replace the main file: archive the current one as a version, then point at the new asset. */
  const replaceFile = async (a: Asset) => {
    if (d.file_asset_id && d.id) {
      const { error } = await supabase.from('document_versions').insert({
        document_id: d.id, version: d.version || 'previous', file_asset_id: d.file_asset_id, preview_asset_id: d.preview_asset_id, note: replaceNote,
      });
      if (error) return f.setError(friendlyDbError(error.message));
    }
    const nextVersion = replaceVersion.trim() || d.version || 'v1';
    const patch: Partial<DocumentRow> = { file_asset_id: a.id, version: nextVersion };
    if (d.file_asset_id) patch.preview_asset_id = null; // the old preview belonged to the old file
    f.setRow((r) => ({ ...r, ...patch }));
    await save(patch);
    setReplaceVersion('');
    setReplaceNote('');
    await invalidateAll(qc);
  };

  const remove = async () => {
    if (!confirm(`Delete document "${d.title}"? The uploaded files stay in the file library (delete them there if unused).`)) return;
    const { error } = await supabase.from('documents').delete().eq('id', d.id!);
    if (error) return f.setError(friendlyDbError(error.message));
    await invalidateAll(qc);
    navigate('/admin/documents', { replace: true });
  };

  return (
    <>
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Documents', to: '/admin/documents' }, { label: f.isNew ? 'New' : d.title! }]} />
      <PageHeader title={f.isNew ? 'New document' : d.title!} actions={!f.isNew && <Link to={`/documents/${d.slug}`} className="btn-secondary">View</Link>} />
      <div className="space-y-6">
        <FormCard title="File" description="PDF previews inline. PPTX is offered as a download; upload a PDF export as the preview to show it inline.">
          <CurrentFile id={d.file_asset_id} label="Current file" />
          {d.file_asset_id && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="New version label" htmlFor="rv"><TextInput id="rv" value={replaceVersion} onChange={setReplaceVersion} placeholder="e.g. v2, final, 2026-11-12" /></Field>
              <Field label="What changed" htmlFor="rn"><TextInput id="rn" value={replaceNote} onChange={setReplaceNote} placeholder="optional" /></Field>
            </div>
          )}
          <FileDropzone
            folder="documents"
            multiple={false}
            compact
            allowedKinds={['pdf', 'pptx', 'image', 'svg', 'data']}
            label={d.file_asset_id ? 'Replace file (previous file is kept in version history)' : 'Upload the document file'}
            onUploaded={async (a) => {
              if (!d.title) f.set('title', a.title);
              if (d.file_asset_id) await replaceFile(a);
              else {
                f.set('file_asset_id', a.id);
                if (!f.isNew) await save({ file_asset_id: a.id });
              }
            }}
          />
          <div className="border-t border-slate-100 pt-4">
            <CurrentFile id={d.preview_asset_id} label="PDF preview" />
            <FileDropzone
              folder="documents/previews"
              multiple={false}
              compact
              allowedKinds={['pdf']}
              label="Upload / replace PDF preview (for PPTX slides)"
              onUploaded={async (a) => {
                f.set('preview_asset_id', a.id);
                if (!f.isNew) await save({ preview_asset_id: a.id });
              }}
            />
            {d.preview_asset_id && <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => void save({ preview_asset_id: null })}>Remove preview</button>}
          </div>
        </FormCard>
        <FormCard title="Metadata">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Title" htmlFor="title" className="md:col-span-2"><TextInput id="title" value={d.title} onChange={(v) => f.set('title', v)} /></Field>
            <Field label="URL slug" htmlFor="slug" help={`/documents/${d.slug || slugify(d.title ?? '') || '…'}`}><TextInput id="slug" value={d.slug} placeholder={slugify(d.title ?? '')} onChange={(v) => f.set('slug', v.toLowerCase())} /></Field>
            <Field label="Category" htmlFor="cat"><Select<DocumentCategory> id="cat" value={d.category ?? 'other'} onChange={(v) => f.set('category', v)} options={Object.entries(documentCategoryLabel) as [DocumentCategory, string][]} /></Field>
            <Field label="Version" htmlFor="ver"><TextInput id="ver" value={d.version} onChange={(v) => f.set('version', v)} /></Field>
            <Field label="Document date" htmlFor="date"><input id="date" type="date" className="input" value={d.document_date ?? ''} onChange={(e) => f.set('document_date', e.target.value || null)} /></Field>
            <Field label="Research thrust" htmlFor="thrust">
              <select id="thrust" className="input" value={d.thrust_id ?? ''} onChange={(e) => f.set('thrust_id', e.target.value || null)}>
                <option value="">— none —</option>
                {(thrusts.data ?? []).map((t) => <option key={t.id} value={t.id}>Part {t.numeral} — {t.title}</option>)}
              </select>
            </Field>
            <Field label="Weekly update" htmlFor="week" help="Weekly slides appear on that week's page.">
              <select id="week" className="input" value={d.weekly_update_id ?? ''} onChange={(e) => f.set('weekly_update_id', e.target.value || null)}>
                <option value="">— none —</option>
                {(weeks.data ?? []).map((w) => <option key={w.id} value={w.id}>Week of {w.week_start}</option>)}
              </select>
            </Field>
            <Field label="Tags" htmlFor="tags" help="Comma-separated"><TextInput id="tags" value={tagText ?? (d.tags ?? []).join(', ')} onChange={setTagText} /></Field>
          </div>
          <Field label="Description" htmlFor="desc"><textarea id="desc" className="input" rows={2} value={d.description ?? ''} onChange={(e) => f.set('description', e.target.value)} /></Field>
          <div className="flex flex-wrap gap-6 text-sm text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!d.important} onChange={(e) => f.set('important', e.target.checked)} /> Show under “Important documents” on Overview</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!d.published} onChange={(e) => f.set('published', e.target.checked)} /> Ready to show (unchecked = draft badge)</label>
          </div>
          <MarkdownField id="body" label="Notes (optional)" value={d.body_md ?? ''} onChange={(v) => f.set('body_md', v)} folder="documents" />
        </FormCard>
        {!f.isNew && (
          <FormCard title="Version history">
            {versions.data?.length ? (
              <ul className="text-sm">
                {versions.data.map((v) => <li key={v.id} className="py-1"><span className="font-medium">{v.version}</span> · replaced {formatDate(v.created_at)}{v.note ? ` · ${v.note}` : ''}</li>)}
              </ul>
            ) : <p className="text-sm text-slate-500">No previous versions.</p>}
          </FormCard>
        )}
        {f.isNew && !d.file_asset_id && <NoticeBox>Upload the file first; the title is pre-filled from the filename.</NoticeBox>}
      </div>
      <SaveBar dirty={f.dirty || tagText !== null} saving={f.saving} error={f.error} savedAt={f.savedAt}>
        {!f.isNew && <button type="button" className="btn-danger" onClick={() => void remove()}>Delete</button>}
        <button type="button" className="btn-primary" disabled={f.saving} onClick={() => void save().then(() => setTagText(null))}>{f.isNew ? 'Create document' : 'Save'}</button>
      </SaveBar>
    </>
  );
}
