// Custom link schemes usable in any Markdown field:
//   ![caption](asset:<uuid>)   embed an uploaded image / audio / video / PDF
//   [text](exp:EXP-0001)       link to an experiment record
//   [text](doc:<slug>)         link to a document
//   [text](paper:<slug>)       link to a survey paper
//   [text](week:YYYY-MM-DD)    link to a weekly progress page
//   [text](model:<slug>)       link to a model component

export const INTERNAL_SCHEMES = ['asset', 'exp', 'doc', 'paper', 'week', 'model'] as const;
export type InternalScheme = (typeof INTERNAL_SCHEMES)[number];

const SAFE_PROTOCOL = /^(https?|mailto):/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseInternalRef(url: string): { scheme: InternalScheme; target: string } | null {
  const m = /^([a-z]+):(.+)$/i.exec(url.trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase() as InternalScheme;
  if (!INTERNAL_SCHEMES.includes(scheme)) return null;
  const target = decodeURIComponent(m[2]);
  if (scheme === 'asset' && !UUID.test(target)) return null;
  return { scheme, target };
}

/** Route path (relative to the router basename) for an internal ref. */
export function routeForRef(scheme: InternalScheme, target: string): string | null {
  switch (scheme) {
    case 'exp':
      return `/experiments/${encodeURIComponent(target)}`;
    case 'doc':
      return `/documents/${encodeURIComponent(target)}`;
    case 'paper':
      return `/survey/${encodeURIComponent(target)}`;
    case 'week':
      return `/progress/${encodeURIComponent(target)}`;
    case 'model':
      return `/models/${encodeURIComponent(target)}`;
    default:
      return null;
  }
}

/**
 * URL filter for react-markdown. Keeps http(s)/mailto, relative anchors and
 * our internal schemes; drops everything else (javascript:, data:, ...).
 */
export function safeUrlTransform(url: string): string {
  const u = url.trim();
  if (parseInternalRef(u)) return u;
  if (SAFE_PROTOCOL.test(u)) return u;
  if (u.startsWith('#')) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';
  return u; // relative path
}

/** Asset ids referenced inline in a Markdown string. */
export function extractAssetIds(markdown: string): string[] {
  const ids = new Set<string>();
  const re = /asset:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) ids.add(m[1].toLowerCase());
  return [...ids];
}

export function assetEmbedSnippet(id: string, caption: string): string {
  return `![${caption.replace(/[[\]]/g, '')}](asset:${id})`;
}
