import type { PaperWithCategories, ReadingStatus } from './types';

export type SortKey = 'year_desc' | 'year_asc' | 'title' | 'added' | 'status';

export interface SurveyFilter {
  query: string;
  category: string | null;
  status: ReadingStatus | 'all';
  sort: SortKey;
}

const statusOrder: Record<ReadingStatus, number> = { important: 0, reading: 1, to_read: 2, reviewed: 3 };

/** Pure filter/sort used by the Survey page (unit-tested). */
export function filterPapers(papers: PaperWithCategories[], f: SurveyFilter): PaperWithCategories[] {
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = papers.filter((p) => {
    if (f.category && !p.paper_category_links.some((l) => l.category_slug === f.category)) return false;
    if (f.status !== 'all' && p.reading_status !== f.status) return false;
    if (!terms.length) return true;
    const hay = [p.title, p.authors, p.venue, String(p.year ?? ''), p.tags.join(' '), p.summary_md, p.relevance_md, p.notes_md, p.contributions_md]
      .join(' ')
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  const byTitle = (a: PaperWithCategories, b: PaperWithCategories) => a.title.localeCompare(b.title);
  switch (f.sort) {
    case 'year_asc':
      return out.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || byTitle(a, b));
    case 'title':
      return out.sort(byTitle);
    case 'added':
      return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case 'status':
      return out.sort((a, b) => statusOrder[a.reading_status] - statusOrder[b.reading_status] || byTitle(a, b));
    default:
      return out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || byTitle(a, b));
  }
}
