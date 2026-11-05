import { useParams } from 'react-router-dom';
import { useAttachments, usePapers, useSurveyCategories } from '../lib/api';
import { publicationStatusLabel, readingStatusLabel } from '../lib/labels';
import { formatDate } from '../lib/dates';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Markdown } from '../components/content/Markdown';
import { AttachmentGroups } from '../components/media/AttachmentGroups';
import { Badge, EditLink, ExternalLink, KeyValue, PageHeader, QueryState, Section, StatusBadge, Tag } from '../components/ui';
import NotFoundPage from './NotFoundPage';
import { useTitle } from '../lib/useTitle';

export default function PaperPage() {
  const { slug } = useParams();
  const papers = usePapers();
  const cats = useSurveyCategories();
  const p = papers.data?.find((x) => x.slug === slug);
  const attachments = useAttachments('paper', p?.id);
  useTitle(p?.title ?? 'Paper');

  return (
    <QueryState isLoading={papers.isLoading} error={papers.error}>
      {!p ? (
        <NotFoundPage what="Paper" />
      ) : (
        <article>
          <Breadcrumbs items={[{ label: 'Survey', to: '/survey' }, { label: p.title }]} />
          <PageHeader
            eyebrow={[p.venue, p.year].filter(Boolean).join(' ') || 'Reference'}
            title={p.title}
            description={p.authors}
            meta={
              <>
                <StatusBadge status={p.reading_status} label={readingStatusLabel[p.reading_status]} />
                {p.publication_status !== 'published' && <Badge tone="warning">{publicationStatusLabel[p.publication_status]}</Badge>}
                {p.team_prior_work && <Badge tone="accent">Team prior work</Badge>}
                {p.paper_category_links.map((l) => (
                  <Tag key={l.category_slug}>{cats.data?.find((c) => c.slug === l.category_slug)?.title ?? l.category_slug}</Tag>
                ))}
              </>
            }
            actions={<EditLink to={`/admin/papers/${p.id}`} />}
          />
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_18rem]">
            <div className="min-w-0 space-y-8">
              <Section title="Summary">{p.summary_md ? <Markdown>{p.summary_md}</Markdown> : <p className="text-sm text-slate-400 italic">No summary yet.</p>}</Section>
              <Section title="Key contributions">{p.contributions_md ? <Markdown>{p.contributions_md}</Markdown> : <p className="text-sm text-slate-400 italic">Not yet summarized.</p>}</Section>
              <Section title="Relevance to our project">{p.relevance_md ? <Markdown>{p.relevance_md}</Markdown> : <p className="text-sm text-slate-400 italic">Not yet written.</p>}</Section>
              <Section title="Research notes">{p.notes_md ? <Markdown>{p.notes_md}</Markdown> : <p className="text-sm text-slate-400 italic">No notes yet.</p>}</Section>
              {!!attachments.data?.length && (
                <Section title="Attachments"><AttachmentGroups links={attachments.data} /></Section>
              )}
            </div>
            <aside className="space-y-6">
              <div className="card space-y-2 p-4 text-sm">
                {p.paper_url ? <div><ExternalLink href={p.paper_url}>Paper</ExternalLink></div> : <div className="text-slate-400">No paper URL recorded</div>}
                {p.project_url && <div><ExternalLink href={p.project_url}>Project page</ExternalLink></div>}
                {p.code_url && <div><ExternalLink href={p.code_url}>Code</ExternalLink></div>}
              </div>
              <KeyValue
                items={[
                  ['Tags', p.tags.length ? p.tags.join(', ') : ''],
                  ['Metadata source', p.source_note],
                  ['Added', formatDate(p.created_at)],
                  ['Last updated', formatDate(p.updated_at)],
                ]}
              />
            </aside>
          </div>
        </article>
      )}
    </QueryState>
  );
}
