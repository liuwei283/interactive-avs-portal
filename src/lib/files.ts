import type { AssetKind } from './types';

interface FileTypeInfo {
  kind: AssetKind;
  mime: string;
}

/** Allowed upload types, keyed by lower-case extension. Mirrors the bucket's allowed_mime_types. */
export const FILE_TYPES: Record<string, FileTypeInfo> = {
  pdf: { kind: 'pdf', mime: 'application/pdf' },
  pptx: { kind: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  png: { kind: 'image', mime: 'image/png' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  webp: { kind: 'image', mime: 'image/webp' },
  gif: { kind: 'image', mime: 'image/gif' },
  svg: { kind: 'svg', mime: 'image/svg+xml' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  webm: { kind: 'video', mime: 'video/webm' },
  wav: { kind: 'audio', mime: 'audio/wav' },
  mp3: { kind: 'audio', mime: 'audio/mpeg' },
  flac: { kind: 'audio', mime: 'audio/flac' },
  json: { kind: 'data', mime: 'application/json' },
  csv: { kind: 'data', mime: 'text/csv' },
};

export const ACCEPT_ATTR = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(',');

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function fileTypeFor(name: string): FileTypeInfo | null {
  return FILE_TYPES[extensionOf(name)] ?? null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  kind?: AssetKind;
  mime?: string;
}

/**
 * Validate a candidate upload by extension, declared MIME type and size.
 * `allowedKinds` optionally narrows the accepted kinds (e.g. only PDF for a preview).
 */
export function validateFile(
  file: { name: string; size: number; type: string },
  maxBytes: number,
  allowedKinds?: AssetKind[],
): ValidationResult {
  const info = fileTypeFor(file.name);
  if (!info) {
    return { ok: false, error: `"${file.name}" has an unsupported file type. Allowed: ${Object.keys(FILE_TYPES).join(', ')}.` };
  }
  if (allowedKinds && !allowedKinds.includes(info.kind)) {
    return { ok: false, error: `"${file.name}" is a ${info.kind} file; expected ${allowedKinds.join(' or ')}.` };
  }
  // Browsers report an empty or generic type for some formats (flac, pptx);
  // when a concrete type IS reported it must agree with the extension's family.
  if (file.type && file.type !== 'application/octet-stream') {
    const family = file.type.split('/')[0];
    const expected = info.mime.split('/')[0];
    const compatible =
      family === expected ||
      (info.kind === 'data' && (file.type === 'application/json' || file.type.startsWith('text/'))) ||
      (info.kind === 'pptx' && file.type.includes('presentation')) ||
      (info.kind === 'pdf' && file.type === 'application/pdf');
    if (!compatible) {
      return { ok: false, error: `"${file.name}" reports type ${file.type}, which does not match its .${extensionOf(file.name)} extension.` };
    }
  }
  if (file.size === 0) return { ok: false, error: `"${file.name}" is empty.` };
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `"${file.name}" is ${formatBytes(file.size)}; the limit is ${formatBytes(maxBytes)}. Compress the file or host large videos elsewhere (see README → Storage limits).`,
    };
  }
  return { ok: true, kind: info.kind, mime: info.mime };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** Storage object key: <folder>/<yyyy-mm>/<random>-<safe-filename>. */
export function buildStoragePath(folder: string, filename: string, now = new Date(), rand = randomId()): string {
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'misc';
  const ext = extensionOf(filename);
  const base = filename.slice(0, ext ? -(ext.length + 1) : undefined);
  const safeBase = base.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'file';
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `${safeFolder}/${ym}/${rand}-${safeBase}${ext ? `.${ext}` : ''}`;
}

function randomId(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
