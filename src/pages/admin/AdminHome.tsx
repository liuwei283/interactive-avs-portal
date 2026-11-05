import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAssets, useDocuments, useExperiments, useModelComponents, usePapers, useWeeklyUpdates } from '../../lib/api';
import { formatBytes } from '../../lib/files';
import { formatDate } from '../../lib/dates';
import { config } from '../../lib/config';
import { PageHeader, StatusBadge } from '../../components/ui';

function ChangePassword() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 12) return setMsg({ ok: false, text: 'Use at least 12 characters.' });
    if (pw !== pw2) return setMsg({ ok: false, text: 'The passwords do not match.' });
    const { error } = await supabase.auth.updateUser({ password: pw });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Password changed.' });
    if (!error) {
      setPw('');
      setPw2('');
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-2 p-4 text-sm">
      <h2 className="font-semibold text-slate-900">Change admin password</h2>
      <input type="password" className="input" autoComplete="new-password" placeholder="New password" aria-label="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <input type="password" className="input" autoComplete="new-password" placeholder="Repeat new password" aria-label="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      <button type="submit" className="btn-secondary btn-sm">Update password</button>
      {msg && <p className={msg.ok ? 'text-emerald-700' : 'text-red-700'} role="status">{msg.text}</p>}
    </form>
  );
}

export default function AdminHome() {
  const weeks = useWeeklyUpdates();
  const exps = useExperiments();
  const comps = useModelComponents();
  const docs = useDocuments();
  const papers = usePapers();
  const assets = useAssets();
  const drafts = (weeks.data ?? []).filter((w) => w.status === 'draft');
  const storage = (assets.data ?? []).reduce((s, a) => s + a.size_bytes, 0);
  const stats: [string, number | string, string][] = [
    ['Weekly updates', weeks.data?.length ?? '…', '/admin/weekly'],
    ['Experiments', exps.data?.length ?? '…', '/admin/experiments'],
    ['Model components', comps.data?.length ?? '…', '/admin/models'],
    ['Documents', docs.data?.length ?? '…', '/admin/documents'],
    ['Papers', papers.data?.length ?? '…', '/admin/papers'],
    ['Files', assets.data?.length ?? '…', '/admin/assets'],
  ];
  return (
    <>
      <PageHeader title="Admin dashboard" description="Create and publish content. Everything here is private to the administrator account." />
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/admin/weekly/new" className="card p-4 hover:border-accent-200 hover:bg-accent-50/40">
          <div className="font-semibold text-slate-900">New weekly update</div>
          <div className="mt-1 text-sm text-slate-500">Pick the week, write the summary, upload slides and demos.</div>
        </Link>
        <Link to="/admin/experiments/new" className="card p-4 hover:border-accent-200 hover:bg-accent-50/40">
          <div className="font-semibold text-slate-900">New experiment record</div>
          <div className="mt-1 text-sm text-slate-500">Reusable across weekly pages and model components.</div>
        </Link>
        <Link to="/admin/assets" className="card p-4 hover:border-accent-200 hover:bg-accent-50/40">
          <div className="font-semibold text-slate-900">Upload files</div>
          <div className="mt-1 text-sm text-slate-500">Figures, audio, video, PDFs, slides, data.</div>
        </Link>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([l, n, to]) => (
          <Link key={l} to={to} className="card p-3 hover:bg-slate-50">
            <div className="text-2xl font-semibold text-slate-900 tabular-nums">{n}</div>
            <div className="text-xs text-slate-500">{l}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 font-semibold text-slate-900">Draft weekly updates</h2>
          {drafts.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {drafts.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2">
                  <Link to={`/admin/weekly/${w.id}`} className="text-accent-700 hover:underline">Week of {formatDate(w.week_start)}</Link>
                  <StatusBadge status="draft" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No drafts.</p>
          )}
        </section>
        <section className="card p-4 text-sm">
          <h2 className="mb-2 font-semibold text-slate-900">Storage</h2>
          <p className="text-slate-700">{formatBytes(storage)} in current file versions (excludes replaced versions).</p>
          <p className="mt-1 text-slate-500">Supabase Free plan: 1 GB storage total, {config.maxUploadMb} MB per file in this portal. Prefer compressed MP4/WebM and short clips.</p>
        </section>
        <ChangePassword />
      </div>
    </>
  );
}
