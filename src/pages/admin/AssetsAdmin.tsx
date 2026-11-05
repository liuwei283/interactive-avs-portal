import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invalidateAll, useAssets, useAssetVersions } from '../../lib/api';
import { assetEmbedSnippet } from '../../lib/markdownRefs';
import { assetReferences, deleteAsset, replaceAssetFile } from '../../lib/storage';
import { formatBytes } from '../../lib/files';
import { formatDate } from '../../lib/dates';
import { parseTags } from '../../lib/slug';
import type { Asset, AssetReference } from '../../lib/types';
import { Badge, EmptyState, PageHeader, Spinner, Tag } from '../../components/ui';
import { FileDropzone } from '../../components/admin/FileDropzone';
import { AssetView } from '../../components/media/AssetView';
import { DownloadButton } from '../../components/content/DownloadButton';

const CATEGORIES = ['general', 'figure', 'demo-audio', 'demo-video', 'slides', 'diagram', 'dataset', 'document'];

function AssetDetail({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const versions = useAssetVersions(asset.id);
  const [title, setTitle] = useState(asset.title);
  const [description, setDescription] = useState(asset.description);
  const [category, setCategory] = useState(asset.category);
  const [tags, setTags] = useState(asset.tags.join(', '));
  const [refs, setRefs] = useState<AssetReference[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const done = async (text: string) => {
    setMsg({ ok: true, text });
    await invalidateAll(qc);
  };
  const fail = (e: unknown) => setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });

  const saveMeta = async () => {
    const { error } = await supabase.from('assets').update({ title, description, category, tags: parseTags(tags) }).eq('id', asset.id);
    if (error) return fail(error);
    await done('Metadata saved.');
  };

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-slate-900">{asset.title || asset.filename}</h2>
          <p className="text-xs text-slate-500">{asset.filename} · {asset.mime_type} · {formatBytes(asset.size_bytes)} · v{asset.version} · {formatDate(asset.updated_at)}</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
      <AssetView asset={asset} compactPdf />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div><label className="label" htmlFor="a-title">Title</label><input id="a-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div>
          <label className="label" htmlFor="a-cat">Category</label>
          <input id="a-cat" className="input" list="asset-cats" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="asset-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="md:col-span-2"><label className="label" htmlFor="a-desc">Description</label><textarea id="a-desc" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label" htmlFor="a-tags">Tags (comma-separated)</label><input id="a-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={() => void saveMeta()}>Save metadata</button>
        <DownloadButton asset={asset} />
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            void navigator.clipboard?.writeText(assetEmbedSnippet(asset.id, asset.title || asset.filename));
            setCopied(true);
          }}
        >
          {copied ? 'Copied!' : 'Copy Markdown embed'}
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => assetReferences(asset.id).then(setRefs).catch(fail)}>Where is this used?</button>
        <button type="button" className="btn-secondary btn-sm" onClick={async () => {
          const { error } = await supabase.from('assets').update({ archived: !asset.archived }).eq('id', asset.id);
          if (error) fail(error); else await done(asset.archived ? 'Restored.' : 'Archived (hidden from pickers; existing pages keep working).');
        }}>{asset.archived ? 'Unarchive' : 'Archive'}</button>
        <button type="button" className="btn-danger btn-sm" onClick={async () => {
          if (!confirm(`Permanently delete "${asset.filename}" and all its previous versions?`)) return;
          try {
            await deleteAsset(asset);
            await invalidateAll(qc);
            onClose();
          } catch (e) {
            fail(e);
          }
        }}>Delete</button>
      </div>
      {refs && (
        <div className="rounded-md border border-slate-200 p-3 text-sm">
          {refs.length ? (
            <ul className="list-inside list-disc text-slate-700">{refs.map((r, i) => <li key={i}>{r.title || r.entity_type} <span className="text-slate-500">({r.entity_type}, {r.via})</span></li>)}</ul>
          ) : <p className="text-slate-500">Not referenced anywhere — safe to delete.</p>}
        </div>
      )}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Replace file</h3>
        <p className="help mb-2">Keeps the same asset id, so every page, experiment and Markdown embed shows the new file. The old file is kept as a previous version.</p>
        <input
          type="file"
          aria-label="Replacement file"
          className="block text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const note = prompt('What changed in this version? (optional)') ?? '';
            try {
              setProgress(0);
              await replaceAssetFile(asset, file, note, { folder: asset.storage_path.split('/')[0] || 'library', onProgress: setProgress });
              await done('File replaced.');
            } catch (err) {
              fail(err);
            } finally {
              setProgress(null);
            }
          }}
        />
        {progress !== null && <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-100"><div className="h-full bg-accent-600" style={{ width: `${progress * 100}%` }} /></div>}
        {!!versions.data?.length && (
          <ul className="mt-3 text-xs text-slate-600">
            {versions.data.map((v) => <li key={v.id}>v{v.version}: {v.filename} · {formatBytes(v.size_bytes)} · {formatDate(v.created_at)}{v.note ? ` · ${v.note}` : ''}</li>)}
          </ul>
        )}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{msg.text}</p>}
    </div>
  );
}

export default function AssetsAdmin() {
  const assets = useAssets();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [category, setCategory] = useState('general');
  const [tagText, setTagText] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = (assets.data ?? []).filter(
    (a) => (showArchived || !a.archived) && (!kind || a.kind === kind) &&
      (!q || [a.title, a.filename, a.description, a.category, a.tags.join(' ')].join(' ').toLowerCase().includes(q.toLowerCase())),
  );
  const open = assets.data?.find((a) => a.id === openId);

  return (
    <>
      <PageHeader title="Files & demo assets" description="Every uploaded file lives in a private bucket and can be reused on any page. Attach files to weekly updates, experiments or components from their editors." />
      <section className="card mb-6 space-y-3 p-5">
        <h2 className="font-semibold text-slate-900">Upload</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="up-cat">Category</label>
            <input id="up-cat" className="input" list="asset-cats-up" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="asset-cats-up">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div><label className="label" htmlFor="up-tags">Tags</label><input id="up-tags" className="input" placeholder="comma-separated" value={tagText} onChange={(e) => setTagText(e.target.value)} /></div>
        </div>
        <FileDropzone folder="library" category={category} tags={parseTags(tagText)} onUploaded={() => invalidateAll(qc)} />
      </section>
      {open && <div className="mb-6"><AssetDetail key={open.id + open.version + open.updated_at} asset={open} onClose={() => setOpenId(null)} /></div>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input max-w-sm" placeholder="Search files…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search files" />
        <select className="input w-36" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {['image', 'svg', 'audio', 'video', 'pdf', 'pptx', 'data'].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
      </div>
      {assets.isLoading ? <Spinner /> : !list.length ? <EmptyState title="No files" /> : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr><th className="px-3 py-2">File</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Size</th><th className="px-3 py-2">Category / tags</th><th className="px-3 py-2">Uploaded</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((a) => (
                <tr key={a.id} className={openId === a.id ? 'bg-accent-50/50' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2"><div className="font-medium text-slate-800">{a.title || a.filename}</div><div className="text-xs text-slate-500">{a.filename}{a.archived && <> · <Badge tone="warning">archived</Badge></>}</div></td>
                  <td className="px-3 py-2 text-xs">{a.kind}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{formatBytes(a.size_bytes)}</td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-1"><Tag>{a.category}</Tag>{a.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div></td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(a.created_at)}</td>
                  <td className="px-3 py-2 text-right"><button type="button" className="btn-secondary btn-sm" onClick={() => { setOpenId(a.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
