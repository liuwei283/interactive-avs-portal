import type { ReactNode } from 'react';

/** Figure wrapper with consistent caption styling. */
export function MediaFrame({ label, caption, children, className = '' }: { label?: string; caption?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={`min-w-0 ${className}`}>
      {label && <div className="mb-1.5 text-xs font-semibold tracking-wide text-slate-600 uppercase">{label}</div>}
      {children}
      {caption && <figcaption className="mt-1.5 text-sm text-slate-500">{caption}</figcaption>}
    </figure>
  );
}

export function MediaError({ message = 'This file could not be loaded.' }: { message?: string }) {
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>;
}

export function MediaLoading({ height = 'h-24' }: { height?: string }) {
  return <div className={`${height} w-full animate-pulse rounded-md bg-slate-100`} aria-label="Loading media" />;
}
