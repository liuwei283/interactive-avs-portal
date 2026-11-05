import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invalidateAll } from '../../lib/api';

/**
 * Load one row (or start from defaults), track edits, and save via
 * insert/update. Warns before leaving the page with unsaved changes.
 */
export function useEntityForm<T extends { id?: string }>(table: string, id: string | undefined, defaults: Partial<T>) {
  const qc = useQueryClient();
  const isNew = !id || id === 'new';
  const [row, setRow] = useState<Partial<T>>(defaults);
  const [original, setOriginal] = useState<Partial<T>>(defaults);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    setLoading(true);
    supabase.from(table).select('*').eq('id', id).maybeSingle().then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError(e.message);
      else if (!data) setError('Record not found.');
      else {
        setRow(data as T);
        setOriginal(data as T);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [table, id, isNew]);

  const dirty = JSON.stringify(row) !== JSON.stringify(original);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = <K extends keyof T>(key: K, value: T[K]) => setRow((r) => ({ ...r, [key]: value }));

  const save = async (patch: Partial<T> = {}): Promise<T | null> => {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = { ...row, ...patch };
    for (const k of ['id', 'created_at', 'updated_at', 'published_at']) delete payload[k];
    // Drop embedded relations (e.g. paper_category_links) that are not columns.
    for (const [k, v] of Object.entries(payload)) if (Array.isArray(v) && v.length && typeof v[0] === 'object') delete payload[k];
    const res = isNew && !row.id
      ? await supabase.from(table).insert(payload).select().single()
      : await supabase.from(table).update(payload).eq('id', (row.id ?? id) as string).select().single();
    setSaving(false);
    if (res.error) {
      setError(friendlyDbError(res.error.message));
      return null;
    }
    setRow(res.data as T);
    setOriginal(res.data as T);
    setSavedAt(new Date());
    await invalidateAll(qc);
    return res.data as T;
  };

  return { row, set, setRow, save, loading, saving, error, setError, dirty, isNew, savedAt };
}

export function friendlyDbError(msg: string): string {
  if (/duplicate key.*week_start/i.test(msg)) return 'A weekly update for this week already exists.';
  if (/duplicate key.*code/i.test(msg)) return 'That experiment ID is already used.';
  if (/duplicate key.*slug/i.test(msg)) return 'That URL slug is already used. Choose another.';
  if (/isodow|weekly_updates_week_start_check/i.test(msg)) return 'The week must start on a Monday.';
  if (/_check/i.test(msg)) return `A field has an invalid value (${msg}).`;
  if (/row-level security|permission denied/i.test(msg)) return 'Not authorized. Your session may have expired — sign in again.';
  if (/foreign key/i.test(msg)) return 'This record is still referenced elsewhere.';
  return msg;
}
