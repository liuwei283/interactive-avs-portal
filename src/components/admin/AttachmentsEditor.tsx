import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateAll, removeAttachment, saveAttachment, useAttachments } from '../../lib/api';
import { linkRoleLabel } from '../../lib/labels';
import type { Asset, ContentAssetLinkWithAsset, EntityType, LinkRole } from '../../lib/types';
import { AssetPicker } from './AssetPicker';
import { ErrorBox } from '../ui';

function defaultRole(a: Asset, preferred?: LinkRole): LinkRole {
  if (preferred) return preferred;
  if (a.kind === 'audio') return 'audio';
  if (a.kind === 'video') return 'video';
  if (a.kind === 'pdf' || a.kind === 'pptx') return 'attachment';
  if (a.kind === 'data') return 'data';
  return 'figure';
}

function Row({ link, onChanged, roles }: { link: ContentAssetLinkWithAsset; onChanged: () => Promise<unknown>; roles: LinkRole[] }) {
  const [draft, setDraft] = useState(link);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = draft.role !== link.role || draft.label !== link.label || draft.group_key !== link.group_key || draft.caption !== link.caption || draft.sort_order !== link.sort_order;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium text-slate-800">
          {link.asset?.title || link.asset?.filename || 'Missing file'}
          <span className="ml-2 text-xs font-normal text-slate-500">{link.asset?.kind}</span>
        </span>
        <span className="flex gap-1.5">
          {dirty && <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => saveAttachment(draft))}>Save</button>}
          <button type="button" className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => removeAttachment(link.id))}>Detach</button>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <select className="input" aria-label="Role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as LinkRole })}>
          {roles.map((r) => <option key={r} value={r}>{linkRoleLabel[r]}</option>)}
        </select>
        <input className="input" placeholder="Label (e.g. Ours, Baseline)" aria-label="Label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <input className="input" placeholder="Comparison group" aria-label="Comparison group" value={draft.group_key} onChange={(e) => setDraft({ ...draft, group_key: e.target.value })} />
        <input className="input" placeholder="Caption" aria-label="Caption" value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
        <input className="input" type="number" aria-label="Order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
      </div>
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </li>
  );
}

/**
 * Attach uploaded files (figures, audio, video, slides, data) to any record.
 * Files sharing a "comparison group" render as an A/B or side-by-side comparison.
 */
export function AttachmentsEditor({
  entityType, entityId, folder, roles = ['figure', 'audio', 'video', 'comparison', 'diagram', 'slides', 'attachment', 'data'], preferredRole, title = 'Attachments',
}: { entityType: EntityType; entityId: string | undefined; folder: string; roles?: LinkRole[]; preferredRole?: LinkRole; title?: string }) {
  const qc = useQueryClient();
  const links = useAttachments(entityType, entityId);
  const [picker, setPicker] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!entityId) return <p className="text-sm text-slate-500">Save this record first, then attach files.</p>;
  const refresh = () => invalidateAll(qc);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setPicker(true)}>Attach / upload file</button>
      </div>
      <p className="help mb-3">Give two or more audio/video files the same <em>comparison group</em> to show them as an A/B player or synced side-by-side; give each a clear label (model, baseline, condition).</p>
      {links.error && <ErrorBox error={links.error} />}
      <ul className="space-y-2">
        {(links.data ?? []).map((l) => <Row key={l.id + l.created_at} link={l} onChanged={refresh} roles={roles} />)}
        {!links.data?.length && <li className="text-sm text-slate-400 italic">No files attached.</li>}
      </ul>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      {picker && (
        <AssetPicker
          folder={folder}
          onClose={() => setPicker(false)}
          onPick={async (a) => {
            setPicker(false);
            setErr(null);
            try {
              await saveAttachment({
                asset_id: a.id,
                entity_type: entityType,
                entity_id: entityId,
                role: defaultRole(a, preferredRole),
                sort_order: (links.data?.length ?? 0) * 10,
              });
              await refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e));
            }
          }}
        />
      )}
    </div>
  );
}
