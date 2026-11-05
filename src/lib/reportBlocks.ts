// Rich blocks usable inside any Markdown field (mainly weekly reports):
//
// ```compare-audio            (also compare-video, compare-image)
// title: Tapping a mug — same video, two models
// caption: optional text under the block
// Ours: asset:<uuid>          (in week.md: a relative file path; sync:week rewrites it)
// Baseline (MMAudio): asset:<uuid>
// ```
//
// ```gallery
// title: optional
// asset:<uuid> | caption
// ```
//
// ```metrics
// title: optional
// condition,FAD ↓,IS ↑        (CSV; first row = header)
// Ours,1.23,4.5
// ```

export const REPORT_BLOCK_TYPES = ['compare-audio', 'compare-video', 'compare-image', 'gallery', 'metrics'] as const;
export type ReportBlockType = (typeof REPORT_BLOCK_TYPES)[number];

export interface MediaItem {
  label: string;
  ref: string;
}

export type ReportBlock =
  | { type: 'compare-audio' | 'compare-video' | 'compare-image'; title: string; caption: string; items: MediaItem[] }
  | { type: 'gallery'; title: string; caption: string; items: MediaItem[] }
  | { type: 'metrics'; title: string; caption: string; header: string[]; rows: string[][] };

export function isReportBlockType(t: string): t is ReportBlockType {
  return (REPORT_BLOCK_TYPES as readonly string[]).includes(t);
}

const META = /^(title|caption)\s*:\s*(.*)$/i;
// "Label: ref" — the ref is the last whitespace-free token, so labels may contain colons.
const LABELLED = /^(.+?)\s*:\s*(\S+)$/;

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseReportBlock(type: ReportBlockType, body: string): ReportBlock {
  let title = '';
  let caption = '';
  const rest: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = META.exec(line);
    if (m && !(type === 'metrics' && rest.length)) {
      if (m[1].toLowerCase() === 'title') title = m[2];
      else caption = m[2];
      continue;
    }
    rest.push(line);
  }
  if (type === 'metrics') {
    const rows = rest.map(splitCsvLine);
    return { type, title, caption, header: rows[0] ?? [], rows: rows.slice(1) };
  }
  if (type === 'gallery') {
    return {
      type, title, caption,
      items: rest.map((l) => {
        const [ref, ...cap] = l.split('|');
        return { ref: ref.trim(), label: cap.join('|').trim() };
      }),
    };
  }
  return {
    type, title, caption,
    items: rest.map((l) => {
      const m = LABELLED.exec(l);
      return m ? { label: m[1].trim(), ref: m[2] } : { label: '', ref: l };
    }),
  };
}

/** asset:<uuid> → uuid, otherwise null (e.g. an un-synced local path). */
export function assetIdOf(ref: string): string | null {
  const m = /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(ref.trim());
  return m ? m[1].toLowerCase() : null;
}

/** "## Heading" lines (outside code fences) → in-page table of contents. */
export function reportHeadings(md: string): { level: number; text: string; id: string }[] {
  const out: { level: number; text: string; id: string }[] = [];
  let fence = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, ''), id: headingId(m[2]) });
  }
  return out;
}

export function headingId(text: string): string {
  return `r-${text.toLowerCase().replace(/[*_`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)}`;
}
