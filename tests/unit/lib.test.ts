import { describe, expect, it } from 'vitest';
import { usernameToEmail, describeAuthError } from '../../src/lib/username';
import { addDays, formatWeekRange, isMonday, weekStartFor } from '../../src/lib/dates';
import { buildStoragePath, validateFile } from '../../src/lib/files';
import { extractAssetIds, parseInternalRef, routeForRef, safeUrlTransform } from '../../src/lib/markdownRefs';
import { isValidExperimentCode, nextExperimentCode, parseTags, slugify } from '../../src/lib/slug';
import { filterPapers } from '../../src/lib/surveyFilter';
import type { PaperWithCategories } from '../../src/lib/types';
import { assetIdOf, parseReportBlock, reportHeadings } from '../../src/lib/reportBlocks';

const MB = 1024 * 1024;
const UUID = '0b6f3c5e-2a51-4c1e-9f7e-3d2a1b0c9e8f';

describe('admin username mapping', () => {
  it('maps only "admin" (case/space-insensitive) to the configured email', () => {
    expect(usernameToEmail('admin', 'a@x.org')).toBe('a@x.org');
    expect(usernameToEmail('  Admin ', 'a@x.org')).toBe('a@x.org');
    expect(usernameToEmail('root', 'a@x.org')).toBeNull();
    expect(usernameToEmail('a@x.org', 'a@x.org')).toBeNull();
    expect(usernameToEmail('admin', '')).toBeNull();
  });
  it('gives clear auth error messages', () => {
    expect(describeAuthError(new Error('Invalid login credentials'))).toBe('Incorrect username or password.');
    expect(describeAuthError(new Error('Failed to fetch'))).toMatch(/Cannot reach/);
  });
});

describe('weekly dates', () => {
  it('maps any day to the Monday of its ISO week', () => {
    expect(weekStartFor('2026-11-02')).toBe('2026-11-02'); // Monday
    expect(weekStartFor('2026-11-05')).toBe('2026-11-02'); // Thursday
    expect(weekStartFor('2026-11-08')).toBe('2026-11-02'); // Sunday
    expect(weekStartFor('2026-11-09')).toBe('2026-11-09');
    expect(weekStartFor('2027-01-01')).toBe('2026-12-28'); // across years
    expect(weekStartFor('nope')).toBeNull();
    expect(weekStartFor('2026-02-30')).toBeNull();
  });
  it('detects Mondays and formats ranges', () => {
    expect(isMonday('2026-11-02')).toBe(true);
    expect(isMonday('2026-11-03')).toBe(false);
    expect(addDays('2026-11-02', 6)).toBe('2026-11-08');
    expect(formatWeekRange('2026-11-02')).toBe('Nov 2 – Nov 8, 2026');
  });
});

describe('upload validation', () => {
  it('accepts every required format', () => {
    for (const n of ['a.pdf', 'b.pptx', 'c.png', 'd.jpg', 'e.webp', 'f.svg', 'g.mp4', 'h.webm', 'i.wav', 'j.mp3', 'k.flac', 'l.json', 'm.csv']) {
      expect(validateFile({ name: n, size: 10, type: '' }, MB).ok, n).toBe(true);
    }
  });
  it('rejects unsupported, empty, oversized and mismatched files', () => {
    expect(validateFile({ name: 'x.exe', size: 10, type: '' }, MB).ok).toBe(false);
    expect(validateFile({ name: 'x.html', size: 10, type: 'text/html' }, MB).ok).toBe(false);
    expect(validateFile({ name: 'x.pdf', size: 0, type: '' }, MB).error).toMatch(/empty/);
    expect(validateFile({ name: 'x.mp4', size: 2 * MB, type: 'video/mp4' }, MB).error).toMatch(/limit/);
    expect(validateFile({ name: 'x.png', size: 10, type: 'video/mp4' }, MB).error).toMatch(/does not match/);
  });
  it('honours allowed kinds and infers MIME from extension', () => {
    expect(validateFile({ name: 'x.png', size: 10, type: '' }, MB, ['pdf']).ok).toBe(false);
    const v = validateFile({ name: 'slides.PPTX', size: 10, type: '' }, MB);
    expect(v.kind).toBe('pptx');
    expect(v.mime).toContain('presentationml');
    expect(validateFile({ name: 'a.flac', size: 10, type: 'audio/x-flac' }, MB).ok).toBe(true);
  });
  it('builds safe storage paths', () => {
    const p = buildStoragePath('weekly/2026-11-02', '../My Slides (final).PDF', new Date(2026, 10, 5), 'abc123');
    expect(p).toBe('weekly/2026-11-02/2026-11/abc123-My-Slides-final.pdf');
    expect(buildStoragePath('', 'x.wav', new Date(2026, 0, 1), 'r')).toBe('misc/2026-01/r-x.wav');
  });
});

describe('markdown references', () => {
  it('parses internal refs and routes', () => {
    expect(parseInternalRef(`asset:${UUID}`)).toEqual({ scheme: 'asset', target: UUID });
    expect(parseInternalRef('asset:not-a-uuid')).toBeNull();
    expect(routeForRef('exp', 'EXP-0001')).toBe('/experiments/EXP-0001');
    expect(routeForRef('week', '2026-11-02')).toBe('/progress/2026-11-02');
  });
  it('strips dangerous URLs but keeps safe and internal ones', () => {
    expect(safeUrlTransform('javascript:alert(1)')).toBe('');
    expect(safeUrlTransform('data:text/html;base64,xx')).toBe('');
    expect(safeUrlTransform('https://arxiv.org/abs/1')).toBe('https://arxiv.org/abs/1');
    expect(safeUrlTransform('exp:EXP-0001')).toBe('exp:EXP-0001');
    expect(safeUrlTransform('#section')).toBe('#section');
  });
  it('extracts embedded asset ids', () => {
    expect(extractAssetIds(`x ![a](asset:${UUID}) y [b](asset:${UUID.toUpperCase()})`)).toEqual([UUID]);
  });
});

describe('slugs and experiment codes', () => {
  it('slugifies', () => expect(slugify('Video-to-Audio Baseline: Café Test!')).toBe('video-to-audio-baseline-cafe-test'));
  it('validates and suggests codes', () => {
    expect(isValidExperimentCode('EXP-0001')).toBe(true);
    expect(isValidExperimentCode('bad code')).toBe(false);
    expect(nextExperimentCode([])).toBe('EXP-0001');
    expect(nextExperimentCode(['EXP-0003', 'EXP-0010', 'OTHER-99'])).toBe('EXP-0011');
  });
  it('parses tags', () => expect(parseTags(' a, b ,a,, c')).toEqual(['a', 'b', 'c']));
});

describe('survey filtering', () => {
  const base = { authors: '', venue: '', tags: [], summary_md: '', relevance_md: '', notes_md: '', contributions_md: '', created_at: '2026-11-05' };
  const papers = [
    { ...base, id: '1', title: 'MMAudio', year: 2025, reading_status: 'to_read', tags: ['v2a'], paper_category_links: [{ category_slug: 'v2a' }] },
    { ...base, id: '2', title: 'RealImpact', year: 2023, reading_status: 'important', paper_category_links: [{ category_slug: 'physics' }, { category_slug: 'contact' }] },
    { ...base, id: '3', title: 'Genie 4', year: null, reading_status: 'reviewed', paper_category_links: [] },
  ] as unknown as PaperWithCategories[];
  it('filters by category, status and query', () => {
    expect(filterPapers(papers, { query: '', category: 'contact', status: 'all', sort: 'year_desc' }).map((p) => p.id)).toEqual(['2']);
    expect(filterPapers(papers, { query: 'v2a', category: null, status: 'all', sort: 'year_desc' }).map((p) => p.id)).toEqual(['1']);
    expect(filterPapers(papers, { query: '', category: null, status: 'important', sort: 'year_desc' }).map((p) => p.id)).toEqual(['2']);
  });
  it('sorts', () => {
    expect(filterPapers(papers, { query: '', category: null, status: 'all', sort: 'year_desc' }).map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(filterPapers(papers, { query: '', category: null, status: 'all', sort: 'title' }).map((p) => p.title)).toEqual(['Genie 4', 'MMAudio', 'RealImpact']);
    expect(filterPapers(papers, { query: '', category: null, status: 'all', sort: 'status' }).map((p) => p.id)).toEqual(['2', '1', '3']);
  });
});

describe('report blocks', () => {
  it('parses compare blocks with labels containing colons', () => {
    const b = parseReportBlock('compare-audio', `title: T\ncaption: C\nOurs: asset:${UUID}\nBaseline: MMAudio: asset:${UUID}\n`);
    expect(b).toMatchObject({ title: 'T', caption: 'C' });
    expect(b.type !== 'metrics' && b.items.map((i) => i.label)).toEqual(['Ours', 'Baseline: MMAudio']);
    expect(assetIdOf(`asset:${UUID}`)).toBe(UUID);
    expect(assetIdOf('figs/a.png')).toBeNull();
  });
  it('parses metrics CSV with quotes', () => {
    const b = parseReportBlock('metrics', 'title: M\ncondition,"FAD, test"\nOurs,1.5\n');
    expect(b.type === 'metrics' && b.header).toEqual(['condition', 'FAD, test']);
    expect(b.type === 'metrics' && b.rows).toEqual([['Ours', '1.5']]);
  });
  it('extracts report headings outside code fences', () => {
    expect(reportHeadings('## A\n```\n## not\n```\n### B *x*').map((h) => [h.level, h.text])).toEqual([[2, 'A'], [3, 'B x']]);
  });
});
