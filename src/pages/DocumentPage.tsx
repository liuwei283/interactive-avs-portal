import { Link, useParams } from 'react-router-dom';
import { useAssets, useDocuments, useDocumentVersions, useThrusts, useWeeklyUpdates } from '../lib/api';
import { documentCategoryLabel } from '../lib/labels';
import { formatDate } from '../lib/dates';
import { formatBytes } from '../lib/files';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Markdown } from '../components/content/Markdown';
import { DownloadButton } from '../components/content/DownloadButton';
import { PdfPreview } from '../components/media/PdfPreview';
import { AssetView } from '../components/media/AssetView';
import { EditLink, EmptyState, KeyValue, NoticeBox, PageHeader, QueryState, Section, StatusBadge, Tag } from '../components/ui';
import NotFoundPage from './NotFoundPage';
import { useTitle } from '../lib/useTitle';

export default function DocumentPage() {
  const { slug } = useParams();
  const docs = useDocuments();
  const assets = useAssets();
  const thrusts = useThrusts();
  const weeks = useWeeklyUpdates();
  const d = docs.data?.find((x) => x.slug === slug);
  const versions = useDocumentVersions(d?.id);
  useTitle(d?.title ?? 'Document');
  const asset = (id: string | null) => assets.data?.find((a) => a.id === id) ?? null;
  const file = asset(d?.file_asset_id ?? null);
  const preview = asset(d?.preview_asset_id ?? null);
  const thrust = thrusts.data?.find((t) => t.id === d?.thrust_id);
  const week = weeks.data?.find((w) => w.id === d?.weekly_update_id);

  return (
    <QueryState isLoading={docs.isLoading || assets.isLoading} error={docs.error || assets.error}>
      {!d ? (
        <NotFoundPage what="Document" />
      ) : (
        <article>
          <Breadcrumbs items={[{ label: 'Documents', to: '/documents' }, { label: d.title }]} />
          <PageHeader
            eyebrow={documentCategoryLabel[d.category]}
            title={d.title}
            description={d.description}
            meta={
              <>
                <Tag>{d.version}</Tag>
                {!d.published && <StatusBadge status="draft" />}
                {d.tags.map((t) => <Tag key={t}>{t}</Tag>)}
              </>
            }
            actions={
              <>
                <DownloadButton asset={file} label={file ? `Download ${file.kind.toUpperCase()}` : 'Download'} className="btn-primary" />
                {preview && preview.id !== file?.id && <DownloadButton asset={preview} label="Download PDF preview" className="btn-secondary" />}
                <EditLink to={`/admin/documents/${d.id}`} />
              </>
            }
          />
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_18rem]">
            <div className="min-w-0 space-y-8">
              {file?.kind === 'pdf' ? (
                <PdfPreview asset={file} />
              ) : preview?.kind === 'pdf' ? (
                <>
                  <NoticeBox>Showing the PDF export of this {file?.kind.toUpperCase() ?? 'file'}. Download the original for speaker notes and animations.</NoticeBox>
                  <PdfPreview asset={preview} />
                </>
              ) : file?.kind === 'pptx' ? (
                <EmptyState title="PowerPoint files cannot be previewed in the browser">
                  Download the .pptx, or upload a PDF export as the preview (Edit → Preview PDF).
                </EmptyState>
              ) : file ? (
                <AssetView asset={file} />
              ) : (
                <EmptyState title="No file attached" />
              )}
              {d.body_md && <Section title="Notes"><Markdown>{d.body_md}</Markdown></Section>}
              <Section title="Version history" description="Previous files are retained when a document is replaced.">
                {versions.data?.length ? (
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {versions.data.map((v) => {
                      const vf = asset(v.file_asset_id);
                      return (
                        <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-slate-800">{v.version}</span>
                            <span className="ml-2 text-slate-500">replaced {formatDate(v.created_at)}</span>
                            {v.note && <div className="text-xs text-slate-500">{v.note}</div>}
                          </div>
                          {vf && <DownloadButton asset={vf} label={`${vf.filename} (${formatBytes(vf.size_bytes)})`} />}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">This is the only version.</p>
                )}
              </Section>
            </div>
            <aside>
              <KeyValue
                items={[
                  ['Document date', formatDate(d.document_date)],
                  ['Uploaded', formatDate(file?.updated_at ?? d.created_at)],
                  ['File', file ? `${file.filename} · ${formatBytes(file.size_bytes)}` : ''],
                  ['Research thrust', thrust ? `Part ${thrust.numeral} — ${thrust.title}` : ''],
                  ['Weekly update', week ? <Link className="text-accent-700 hover:underline" to={`/progress/${week.week_start}`}>Week of {formatDate(week.week_start)}</Link> : ''],
                  ['Last edited', formatDate(d.updated_at)],
                ]}
              />
            </aside>
          </div>
        </article>
      )}
    </QueryState>
  );
}
