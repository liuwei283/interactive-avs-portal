import { useRef, useState, type DragEvent } from 'react';
import { ACCEPT_ATTR, formatBytes, validateFile } from '../../lib/files';
import { config } from '../../lib/config';
import { createAsset } from '../../lib/storage';
import type { Asset, AssetKind } from '../../lib/types';

interface Item {
  key: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

/**
 * Drag-and-drop / click uploader. Validates type and size before upload,
 * shows per-file progress, and registers each file in `assets`.
 */
export function FileDropzone({
  folder, onUploaded, allowedKinds, multiple = true, category = 'general', tags = [], compact = false, label,
}: {
  folder: string;
  onUploaded: (asset: Asset) => void | Promise<void>;
  allowedKinds?: AssetKind[];
  multiple?: boolean;
  category?: string;
  tags?: string[];
  compact?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [description, setDescription] = useState('');
  const maxBytes = config.maxUploadMb * 1024 * 1024;

  const update = (key: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const handle = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, multiple ? undefined : 1);
    const fresh: Item[] = list.map((f) => {
      const v = validateFile(f, maxBytes, allowedKinds);
      return { key: `${f.name}-${f.size}-${Math.random()}`, file: f, progress: 0, status: v.ok ? 'pending' : 'error', error: v.error };
    });
    setItems((xs) => [...fresh, ...xs.filter((x) => x.status === 'uploading' || x.status === 'error')].slice(0, 20));
    for (const it of fresh.filter((x) => x.status === 'pending')) {
      update(it.key, { status: 'uploading' });
      try {
        const asset = await createAsset(it.file, { description, category, tags }, {
          folder,
          allowedKinds,
          onProgress: (p) => update(it.key, { progress: p }),
        });
        update(it.key, { status: 'done', progress: 1 });
        await onUploaded(asset);
      } catch (err) {
        update(it.key, { status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files?.length) void handle(e.dataTransfer.files);
  };

  const accept = allowedKinds
    ? ACCEPT_ATTR.split(',').filter((ext) => {
        const v = validateFile({ name: `x${ext}`, size: 1, type: '' }, maxBytes, allowedKinds);
        return v.ok;
      }).join(',')
    : ACCEPT_ATTR;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors ${compact ? 'px-4 py-4' : 'px-6 py-8'} ${over ? 'border-accent-500 bg-accent-50' : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'}`}
      >
        <span className="text-sm font-medium text-slate-700">{label ?? (multiple ? 'Drop files here or click to choose' : 'Drop a file here or click to choose')}</span>
        <span className="mt-1 text-xs text-slate-500">
          {accept.replace(/\./g, '').replace(/,/g, ', ')} · up to {config.maxUploadMb} MB each
        </span>
        <input ref={input} type="file" className="sr-only" multiple={multiple} accept={accept} onChange={(e) => e.target.files && void handle(e.target.files).finally(() => (e.target.value = ''))} />
      </div>
      {!compact && (
        <input className="input mt-2" placeholder="Optional description applied to these uploads" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Upload description" />
      )}
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {items.map((it) => (
            <li key={it.key} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700">{it.file.name} <span className="text-slate-400">({formatBytes(it.file.size)})</span></span>
                <span className={`text-xs ${it.status === 'error' ? 'text-red-700' : it.status === 'done' ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {it.status === 'uploading' ? `${Math.round(it.progress * 100)}%` : it.status === 'done' ? 'Uploaded' : it.status === 'error' ? 'Failed' : 'Waiting'}
                </span>
              </div>
              {it.status === 'uploading' && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-slate-100" role="progressbar" aria-valuenow={Math.round(it.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-accent-600 transition-all" style={{ width: `${it.progress * 100}%` }} />
                </div>
              )}
              {it.error && <p className="mt-1 text-xs text-red-700">{it.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
