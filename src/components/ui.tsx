import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toneForStatus, type Tone } from '../lib/labels';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  accent: 'bg-accent-50 text-accent-700 ring-accent-200',
};

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={toneForStatus(status)}>{label ?? status.replace(/_/g, ' ')}</Badge>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{children}</span>;
}

export function PageHeader({
  eyebrow, title, description, actions, meta,
}: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description && <div className="mt-2 max-w-3xl text-slate-600">{description}</div>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">{meta}</div>}
      </div>
      {actions && <div className="no-print flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  id, title, children, actions, description,
}: { id?: string; title: ReactNode; children: ReactNode; actions?: ReactNode; description?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="section-title">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-6 py-8 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-xl text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorBox({ error, title = 'Something went wrong' }: { error: unknown; title?: string }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 break-words">{msg}</p>
    </div>
  );
}

export function NoticeBox({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  const cls = tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-accent-200 bg-accent-50 text-accent-800';
  return <div className={`rounded-md border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function QueryState({ isLoading, error, children }: { isLoading: boolean; error: unknown; children: ReactNode }) {
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} title="Could not load data" />;
  return <>{children}</>;
}

export function EditLink({ to, children = 'Edit' }: { to: string; children?: ReactNode }) {
  return (
    <Link to={to} className="btn-secondary btn-sm no-print">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      {children}
    </Link>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  const visible = items.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!visible.length) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {visible.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{k}</dt>
          <dd className="mt-0.5 break-words text-slate-800">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">
      {children}
      <span aria-hidden> ↗</span>
    </a>
  );
}
