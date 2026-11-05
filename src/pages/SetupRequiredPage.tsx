import { missingConfig } from '../lib/config';

export default function SetupRequiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-lg p-6">
        <h1 className="text-lg font-semibold text-slate-900">Backend not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          This build has no Supabase connection settings, so the portal cannot authenticate or load content. Set the
          following build-time variables (locally in <code>.env.local</code>, or as GitHub repository variables for
          deployment) and rebuild:
        </p>
        <ul className="mt-3 list-inside list-disc font-mono text-sm text-slate-800">
          {missingConfig().map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-500">See README → “Local setup” and “Supabase project setup”.</p>
      </div>
    </div>
  );
}
