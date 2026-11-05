import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateAll, useAssets } from '../../lib/api';
import { formatBytes } from '../../lib/files';
import { formatDate } from '../../lib/dates';
import type { Asset, AssetKind } from '../../lib/types';
import { FileDropzone } from './FileDropzone';

/** Modal: choose an existing asset (reuse) or upload a new one. */
export function AssetPicker({
  onPick, onClose, kinds, folder = 'library', title = 'Choose a file',
}: { onPick: (a: Asset) => void; onClose: () => void; kinds?: AssetKind[]; folder?: string; title?: string }) {
  const assets = useAssets();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string>('');
  const list = (assets.data ?? []).filter(
    (a) =>
      !a.archived &&
      (!kinds || kinds.includes(a.kind)) &&
      (!kind || a.kind === kind) &&
      (!q || [a.title, a.filename, a.description, a.tags.join(' '), a.category].join(' ').toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-10" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="space-y-4 p-5">
          <FileDropzone
            folder={folder}
            allowedKinds={kinds}
            compact
            label="Upload a new file (drop or click)"
            onUploaded={async (a) => {
              await invalidateAll(qc);
              onPick(a);
            }}
          />
          <div className="flex gap-2">
            <input className="input" placeholder="Search existing files…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search files" />
            <select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="File type">
              <option value="">All types</option>
              {['image', 'svg', 'audio', 'video', 'pdf', 'pptx', 'data'].filter((k) => !kinds || kinds.includes(k as AssetKind)).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
            {list.map((a) => (
              <li key={a.id}>
                <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent-50" onClick={() => onPick(a)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{a.title || a.filename}</span>
                    <span className="block truncate text-xs text-slate-500">{a.filename} · {a.kind} · {formatBytes(a.size_bytes)} · {formatDate(a.created_at)}{a.tags.length ? ` · ${a.tags.join(', ')}` : ''}</span>
                  </span>
                  <span className="text-xs text-accent-700">Select</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="px-3 py-6 text-center text-sm text-slate-500">{assets.isLoading ? 'Loading…' : 'No matching files.'}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
