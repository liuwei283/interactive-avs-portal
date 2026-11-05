import type { ReactNode } from 'react';

export function SaveBar({ dirty, saving, error, savedAt, children }: { dirty: boolean; saving: boolean; error: string | null; savedAt: Date | null; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm" aria-live="polite">
          {error ? (
            <span className="text-red-700">{error}</span>
          ) : saving ? (
            <span className="text-slate-500">Saving…</span>
          ) : dirty ? (
            <span className="text-amber-700">Unsaved changes</span>
          ) : savedAt ? (
            <span className="text-emerald-700">Saved {savedAt.toLocaleTimeString()}</span>
          ) : (
            <span className="text-slate-400">No changes</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}
