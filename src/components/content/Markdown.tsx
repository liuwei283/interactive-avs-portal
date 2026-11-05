import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Link } from 'react-router-dom';
import { parseInternalRef, routeForRef, safeUrlTransform } from '../../lib/markdownRefs';
import { useAsset } from '../../lib/api';
import { AssetView } from '../media/AssetView';
import { MediaError, MediaLoading } from '../media/MediaFrame';
import { headingId, isReportBlockType } from '../../lib/reportBlocks';
import { ReportBlockView } from './ReportBlockView';
import type { ReactNode } from 'react';

function textOf(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  if (children && typeof children === 'object' && 'props' in children) return textOf((children as { props: { children?: ReactNode } }).props.children);
  return '';
}

function InlineAsset({ id, caption }: { id: string; caption: string }) {
  const asset = useAsset(id);
  if (asset.isLoading) return <MediaLoading height="h-24" />;
  if (!asset.data) return <MediaError message={`Embedded file not found (asset:${id}).`} />;
  return (
    <div className="not-prose my-4">
      <AssetView asset={asset.data} caption={caption || undefined} />
    </div>
  );
}

const components: Components = {
  // Avoid <figure>/<div> inside <p> when a paragraph only contains an embed.
  p({ node, children }) {
    const kids = node?.children ?? [];
    const onlyImage = kids.length === 1 && kids[0].type === 'element' && kids[0].tagName === 'img';
    return onlyImage ? <div>{children}</div> : <p>{children}</p>;
  },
  img({ src, alt }) {
    const ref = src ? parseInternalRef(String(src)) : null;
    if (ref?.scheme === 'asset') return <InlineAsset id={ref.target} caption={alt ?? ''} />;
    if (!src) return null;
    return <img src={String(src)} alt={alt ?? ''} loading="lazy" />;
  },
  a({ href, children }) {
    const ref = href ? parseInternalRef(href) : null;
    if (ref) {
      const to = routeForRef(ref.scheme, ref.target);
      if (to) return <Link to={to}>{children}</Link>;
      if (ref.scheme === 'asset') return <InlineAsset id={ref.target} caption={String(children ?? '')} />;
    }
    if (href && /^https?:/i.test(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    return <a href={href}>{children}</a>;
  },
  // ```compare-audio / compare-video / compare-image / gallery / metrics blocks
  pre({ node, children }) {
    const code = node?.children?.[0];
    if (code && code.type === 'element' && code.tagName === 'code') {
      const cls = ([] as string[]).concat((code.properties?.className as string[] | undefined) ?? []);
      const lang = cls.find((c) => String(c).startsWith('language-'))?.slice('language-'.length);
      if (lang && isReportBlockType(lang)) {
        const body = code.children.map((c) => ('value' in c ? String(c.value) : '')).join('');
        return <ReportBlockView type={lang} body={body} />;
      }
    }
    return <pre>{children}</pre>;
  },
  h2({ children }) {
    return <h2 id={headingId(textOf(children))} className="scroll-mt-24">{children}</h2>;
  },
  h3({ children }) {
    return <h3 id={headingId(textOf(children))} className="scroll-mt-24">{children}</h3>;
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto">
        <table>{children}</table>
      </div>
    );
  },
};

/**
 * Markdown with GFM tables/task lists, LaTeX ($…$, $$…$$), and internal
 * embeds. Raw HTML is NOT rendered (react-markdown escapes it), and URLs
 * are filtered through safeUrlTransform.
 */
export function Markdown({ children, className = '' }: { children: string | null | undefined; className?: string }) {
  if (!children?.trim()) return null;
  return (
    <div className={`prose-research ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
        urlTransform={safeUrlTransform}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Markdown section that renders nothing when empty (or an explicit placeholder). */
export function MdBlock({ title, md, empty }: { title: string; md: string | null | undefined; empty?: string }) {
  if (!md?.trim() && !empty) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold text-slate-700">{title}</h3>
      {md?.trim() ? <Markdown>{md}</Markdown> : <p className="text-sm text-slate-400 italic">{empty}</p>}
    </div>
  );
}
