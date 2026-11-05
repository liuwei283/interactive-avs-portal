import type { ReactNode } from 'react';

export function Field({ label, help, children, htmlFor, className = '' }: { label: string; help?: ReactNode; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function TextInput({ id, value, onChange, placeholder, type = 'text', required }: { id: string; value: string | number | null | undefined; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return <input id={id} type={type} className="input" value={value ?? ''} placeholder={placeholder} required={required} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string>({ id, value, onChange, options }: { id: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function FormCard({ title, children, description, actions }: { title: string; children: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
