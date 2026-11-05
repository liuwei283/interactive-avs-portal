import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="no-print mb-4 text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-slate-300">/</span>}
            {c.to ? (
              <Link to={c.to} className="hover:text-slate-800 hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-slate-700">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
