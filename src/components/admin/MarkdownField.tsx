import { useRef, useState } from 'react';
import { useDocuments, useExperiments } from '../../lib/api';
import { assetEmbedSnippet } from '../../lib/markdownRefs';
import { Markdown } from '../content/Markdown';
import { AssetPicker } from './AssetPicker';

/**
 * Markdown editor: write/preview tabs plus helpers to embed uploaded files
 * and link experiments/documents. Supports GFM tables, code blocks, and
 * LaTeX ($inline$, $$display$$).
 */
export function MarkdownField({
  id, label, value, onChange, rows = 6, help, folder = 'inline',
}: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number; help?: string; folder?: string }) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [picker, setPicker] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const experiments = useExperiments();
  const documents = useDocuments();

  const insert = (snippet: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const pad = before && !before.endsWith('\n') && snippet.startsWith('!') ? '\n' : '';
    const next = `${before}${pad}${snippet}${value.slice(end)}`;
    onChange(next);
    setTab('write');
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + pad.length + snippet.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={id} className="label mb-0">{label}</label>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setPicker(true)}>Insert file</button>
          <select
            className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700"
            value=""
            aria-label="Link an experiment"
            onChange={(e) => e.target.value && insert(`[${e.target.value}](exp:${e.target.value})`)}
          >
            <option value="">Link experiment…</option>
            {(experiments.data ?? []).map((x) => <option key={x.id} value={x.code}>{x.code} — {x.name}</option>)}
          </select>
          <select
            className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700"
            value=""
            aria-label="Link a document"
            onChange={(e) => {
              const d = documents.data?.find((x) => x.slug === e.target.value);
              if (d) insert(`[${d.title}](doc:${d.slug})`);
            }}
          >
            <option value="">Link document…</option>
            {(documents.data ?? []).map((d) => <option key={d.id} value={d.slug}>{d.title}</option>)}
          </select>
          <span className="ml-1 inline-flex overflow-hidden rounded-md border border-slate-300" role="tablist">
            {(['write', 'preview'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-2 py-1 capitalize ${tab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                {t}
              </button>
            ))}
          </span>
        </div>
      </div>
      {tab === 'write' ? (
        <textarea id={id} ref={area} className="input font-mono text-[13px] leading-relaxed" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} spellCheck />
      ) : (
        <div className="min-h-24 rounded-md border border-slate-200 px-4 py-3">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-slate-400 italic">Nothing to preview.</p>}
        </div>
      )}
      <p className="help">
        {help ? `${help} ` : ''}Markdown · tables · code · math with <code>$…$</code> / <code>$$…$$</code> · embeds <code>![caption](asset:id)</code> · links <code>exp:</code> <code>doc:</code> <code>week:</code> <code>model:</code> <code>paper:</code>
      </p>
      {picker && (
        <AssetPicker
          folder={folder}
          title="Embed a file"
          onClose={() => setPicker(false)}
          onPick={(a) => {
            setPicker(false);
            insert(assetEmbedSnippet(a.id, a.title || a.filename));
          }}
        />
      )}
    </div>
  );
}
