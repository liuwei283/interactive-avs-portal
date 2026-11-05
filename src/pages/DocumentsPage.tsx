import { Link, useSearchParams } from 'react-router-dom';
import { useAssets, useDocuments, useThrusts } from '../lib/api';
import { documentCategoryLabel } from '../lib/labels';
import { formatDate } from '../lib/dates';
import { formatBytes } from '../lib/files';
import type { DocumentCategory, DocumentRow } from '../lib/types';
import { DownloadButton } from '../components/content/DownloadButton';
import { EmptyState, PageHeader, QueryState, StatusBadge, Tag } from '../components/ui';
import { useTitle } from '../lib/useTitle';

export default function DocumentsPage() {
  useTitle('Documents');
  const docs = useDocuments();
  const assets = useAssets();
  const thrusts = useThrusts();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').toLowerCase();
  const cat = params.get('category') as DocumentCategory | null;
  const thrust = params.get('thrust');

  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };

  const asset = (id: string | null) => assets.data?.find((a) => a.id === id);
  const visible = (docs.data ?? []).filter(
    (d) =>
      (!cat || d.category === cat) &&
      (!thrust || d.thrust_id === thrust) &&
      (!q || [d.title, d.description, d.tags.join(' '), d.version].join(' ').toLowerCase().includes(q)),
  );
  const groups = (Object.keys(documentCategoryLabel) as DocumentCategory[])
    .map((c) => [c, visible.filter((d) => d.category === c)] as [DocumentCategory, DocumentRow[]])
    .filter(([, ds]) => ds.length);

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Documents"
        description="Proposals, slides, design documents, diagrams and notes. Files are stored privately and served through short-lived signed links."
        actions={<Link to="/admin/documents/new" className="btn-primary">Upload document</Link>}
      />
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input type="search" className="input" placeholder="Search documents…" aria-label="Search documents" value={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value || null)} />
        <select className="input" aria-label="Category" value={cat ?? ''} onChange={(e) => set('category', e.target.value || null)}>
          <option value="">All categories</option>
          {Object.entries(documentCategoryLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" aria-label="Research thrust" value={thrust ?? ''} onChange={(e) => set('thrust', e.target.value || null)}>
          <option value="">All thrusts</option>
          {(thrusts.data ?? []).map((t) => <option key={t.id} value={t.id}>Part {t.numeral} — {t.title}</option>)}
        </select>
      </div>
      <QueryState isLoading={docs.isLoading || assets.isLoading} error={docs.error || assets.error}>
        {!groups.length ? (
          <EmptyState
            title={docs.data?.length ? 'No documents match these filters' : 'No documents uploaded yet'}
            action={!docs.data?.length && <Link to="/admin/documents/new" className="btn-primary btn-sm">Upload the first document</Link>}
          >
            {!docs.data?.length && 'Upload the proposal PDF and slides from the admin dashboard, or use the import script (README → Importing existing files).'}
          </EmptyState>
        ) : (
          <div className="space-y-10">
            {groups.map(([c, ds]) => (
              <section key={c}>
                <h2 className="section-title mb-3">{documentCategoryLabel[c]}</h2>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Title</th>
                        <th className="px-3 py-2 font-semibold">Version</th>
                        <th className="px-3 py-2 font-semibold">Document date</th>
                        <th className="px-3 py-2 font-semibold">Uploaded</th>
                        <th className="px-3 py-2 font-semibold">Thrust</th>
                        <th className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ds.map((d) => {
                        const file = asset(d.file_asset_id);
                        const t = thrusts.data?.find((x) => x.id === d.thrust_id);
                        return (
                          <tr key={d.id} className="align-top hover:bg-slate-50">
                            <td className="px-3 py-2.5">
                              <Link to={`/documents/${d.slug}`} className="font-medium text-slate-900 hover:underline">{d.title}</Link>
                              {!d.published && <span className="ml-2"><StatusBadge status="draft" /></span>}
                              {d.description && <div className="mt-0.5 max-w-xl text-xs text-slate-500">{d.description}</div>}
                              <div className="mt-1 flex flex-wrap gap-1">
                                {file && <Tag>{file.kind.toUpperCase()} · {formatBytes(file.size_bytes)}</Tag>}
                                {d.tags.map((tg) => <Tag key={tg}>{tg}</Tag>)}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{d.version}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDate(d.document_date)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDate(file?.updated_at ?? d.created_at)}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">{t ? `Part ${t.numeral}` : '—'}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex justify-end gap-1.5">
                                <Link to={`/documents/${d.slug}`} className="btn-secondary btn-sm">View</Link>
                                <DownloadButton asset={file} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
