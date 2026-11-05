// Pure helpers for sync-week: parse week.md, find local file references,
// rewrite them to asset:<uuid>, inline metrics CSVs. No I/O except via callbacks.
import YAML from 'yaml';

export const BLOCKS = new Set(['compare-audio', 'compare-video', 'compare-image', 'gallery', 'metrics']);

export const FILE_TYPES = {
  '.pdf': ['pdf', 'application/pdf'],
  '.pptx': ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.png': ['image', 'image/png'], '.jpg': ['image', 'image/jpeg'], '.jpeg': ['image', 'image/jpeg'],
  '.webp': ['image', 'image/webp'], '.gif': ['image', 'image/gif'], '.svg': ['svg', 'image/svg+xml'],
  '.mp4': ['video', 'video/mp4'], '.webm': ['video', 'video/webm'],
  '.wav': ['audio', 'audio/wav'], '.mp3': ['audio', 'audio/mpeg'], '.flac': ['audio', 'audio/flac'],
  '.json': ['data', 'application/json'], '.csv': ['data', 'text/csv'],
};

export function parseWeekFile(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = YAML.parse(m[1]) ?? {};
  for (const k of ['week_start', 'meeting_date']) if (meta[k] instanceof Date) meta[k] = meta[k].toISOString().slice(0, 10);
  return { meta, body: m[2] };
}

export function isLocalRef(ref) {
  const r = ref.trim();
  return !!r && !/^[a-z][a-z0-9+.-]*:/i.test(r) && !r.startsWith('#') && !r.startsWith('//');
}

const MD_LINK = /(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^)\s]+)((?:\s+"[^"\n]*")?\))/g;
const LABELLED = /^(\s*)(.+?)(\s*:\s*)(\S+)(\s*)$/;
const META = /^\s*(title|caption)\s*:/i;

/**
 * Walk the body, calling `map(ref, kind)` for every local file reference.
 * kind: 'link' (markdown link/image), 'media' (block item), 'csv' (metrics csv: path).
 * `map` returns the replacement text (for 'csv': the CSV contents to inline).
 */
export function transformRefs(body, map) {
  const lines = body.split('\n');
  const out = [];
  let fence = null; // { marker, lang }
  for (const line of lines) {
    const open = /^(\s*)(```+|~~~+)\s*([\w-]*)\s*$/.exec(line);
    if (!fence && open) {
      fence = { marker: open[2], lang: open[3] };
      out.push(line);
      continue;
    }
    if (fence && line.trim().startsWith(fence.marker) && line.trim().replace(/[`~]/g, '') === '') {
      fence = null;
      out.push(line);
      continue;
    }
    if (fence) {
      if (!BLOCKS.has(fence.lang) || !line.trim() || META.test(line)) {
        out.push(line);
        continue;
      }
      if (fence.lang === 'metrics') {
        const c = /^\s*csv\s*:\s*(\S+)\s*$/i.exec(line);
        out.push(c && isLocalRef(c[1]) ? map(c[1], 'csv').trimEnd() : line);
      } else if (fence.lang === 'gallery') {
        const [ref, ...rest] = line.split('|');
        out.push(isLocalRef(ref) ? [map(ref.trim(), 'media'), ...rest].join(' |') .replace(/ \|\s*$/, '') : line);
      } else {
        const m = LABELLED.exec(line);
        out.push(m && isLocalRef(m[4]) ? `${m[1]}${m[2]}${m[3]}${map(m[4], 'media')}${m[5]}` : line);
      }
      continue;
    }
    out.push(
      line.replace(MD_LINK, (all, pre, target, post) => {
        const ref = target.startsWith('<') ? target.slice(1, -1) : target;
        return isLocalRef(ref) ? `${pre}${map(ref, 'link')}${post}` : all;
      }),
    );
  }
  return out.join('\n');
}

/** List local references without changing anything. */
export function collectRefs(body) {
  const refs = [];
  transformRefs(body, (ref, kind) => {
    refs.push({ ref, kind });
    return ref;
  });
  return refs;
}

export function isMonday(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(d.getTime()) && d.getUTCDay() === 1;
}

export function mondayOf(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
