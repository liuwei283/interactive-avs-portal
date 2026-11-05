// In-memory stand-in for the subset of supabase-js the app uses.
// It lets the real <App> run end-to-end in jsdom. It does NOT emulate RLS;
// authorization is tested against real Postgres in tests/db/.

type Row = Record<string, unknown>;
type Listener = (event: string, session: unknown) => void;

const ADMIN_EMAIL = 'admin@example.org';
const PASSWORD = 'correct-horse';

const TEXT_DEFAULTS: Record<string, Row> = {
  weekly_updates: Object.fromEntries(
    ['title', 'research_focus', 'goals_md', 'summary_md', 'accomplishments_md', 'agenda_md', 'discussion_questions_md',
      'implementation_changes_md', 'results_md', 'issues_md', 'failed_experiments_md', 'hypotheses_md', 'lessons_md',
      'uncertainties_md', 'planned_experiments_md', 'priorities_md', 'followups_md', 'open_questions_md',
      'discussion_notes_md', 'decisions_md', 'action_items_md'].map((k) => [k, '']),
  ),
  experiments: Object.fromEntries(
    ['research_question', 'hypothesis', 'dataset', 'model_checkpoint', 'config_md', 'baseline_md', 'observations_md',
      'conclusions_md', 'limitations_md'].map((k) => [k, '']),
  ),
  weekly_update_experiments: { note: '', sort_order: 0 },
};

export function createFakeSupabase(seed: Record<string, Row[]>) {
  const db: Record<string, Row[]> = structuredClone(seed);
  let session: { access_token: string; user: { id: string; email: string } } | null = null;
  const listeners = new Set<Listener>();
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const now = () => new Date().toISOString();
  const table = (t: string) => (db[t] ??= []);

  class Builder implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
    private filters: ((r: Row) => boolean)[] = [];
    private orders: [string, boolean][] = [];
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private payload: Row | Row[] | null = null;
    private sel = '*';
    private mode: 'many' | 'single' | 'maybe' = 'many';
    constructor(private t: string) {}
    select(s = '*') { this.sel = s; return this; }
    eq(c: string, v: unknown) { this.filters.push((r) => String(r[c]) === String(v)); return this; }
    in(c: string, vs: unknown[]) { this.filters.push((r) => vs.map(String).includes(String(r[c]))); return this; }
    order(c: string, o?: { ascending?: boolean }) { this.orders.push([c, o?.ascending !== false]); return this; }
    insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this; }
    update(p: Row) { this.op = 'update'; this.payload = p; return this; }
    delete() { this.op = 'delete'; return this; }
    single() { this.mode = 'single'; return this; }
    maybeSingle() { this.mode = 'maybe'; return this; }

    private embed(r: Row): Row {
      const out = { ...r };
      if (this.sel.includes('paper_category_links')) out.paper_category_links = table('paper_category_links').filter((l) => l.paper_id === r.id).map((l) => ({ category_slug: l.category_slug }));
      if (this.sel.includes('asset:assets')) out.asset = table('assets').find((a) => a.id === r.asset_id) ?? null;
      return out;
    }

    private exec(): { data: unknown; error: { message: string } | null } {
      if (!session) return { data: this.mode === 'many' ? [] : null, error: null }; // like RLS: nothing visible
      const rows = table(this.t);
      let result: Row[] = [];
      if (this.op === 'insert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
        for (const p of items) {
          if (this.t === 'weekly_updates') {
            const d = new Date(`${p.week_start}T00:00:00`);
            if (d.getDay() !== 1) return { data: null, error: { message: 'new row violates check constraint "weekly_updates_week_start_check"' } };
            if (rows.some((r) => r.week_start === p.week_start)) return { data: null, error: { message: 'duplicate key value violates unique constraint "weekly_updates_week_start_key"' } };
          }
          if (this.t === 'experiments' && rows.some((r) => r.code === p.code)) return { data: null, error: { message: 'duplicate key value violates unique constraint "experiments_code_key"' } };
          const row: Row = { id: id(), created_at: now(), updated_at: now(), ...TEXT_DEFAULTS[this.t], ...p };
          if (this.t === 'weekly_updates') row.published_at = row.status === 'published' ? now() : null;
          rows.push(row);
          result.push(row);
        }
      } else {
        const matched = rows.filter((r) => this.filters.every((f) => f(r)));
        if (this.op === 'update') {
          for (const r of matched) {
            Object.assign(r, this.payload, { updated_at: now() });
            if (this.t === 'weekly_updates') r.published_at = r.status === 'published' ? (r.published_at ?? now()) : null;
          }
          result = matched;
        } else if (this.op === 'delete') {
          db[this.t] = rows.filter((r) => !matched.includes(r));
          result = matched;
        } else {
          result = matched.slice();
          for (const [c, asc] of [...this.orders].reverse()) {
            result.sort((a, b) => {
              const x = a[c] as string | number | null;
              const y = b[c] as string | number | null;
              if (x === y) return 0;
              if (x === null || x === undefined) return 1;
              if (y === null || y === undefined) return -1;
              return (x < y ? -1 : 1) * (asc ? 1 : -1);
            });
          }
        }
      }
      const data = result.map((r) => this.embed(r));
      if (this.mode === 'single') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      if (this.mode === 'maybe') return { data: data[0] ?? null, error: null };
      return { data, error: null };
    }

    then<A, B>(ok?: ((v: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve().then(() => this.exec()).then(ok, bad);
    }
  }

  const emit = (event: string) => listeners.forEach((l) => l(event, session));

  const client = {
    from: (t: string) => new Builder(t),
    rpc: async (fn: string) => {
      if (fn === 'is_admin') return { data: !!session, error: null };
      if (fn === 'asset_references') return { data: [], error: null };
      return { data: null, error: { message: `unknown rpc ${fn}` } };
    },
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: (cb: Listener) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        if (email !== ADMIN_EMAIL || password !== PASSWORD) return { data: { session: null, user: null }, error: new Error('Invalid login credentials') };
        session = { access_token: 'fake-token', user: { id: 'admin-user', email } };
        emit('SIGNED_IN');
        return { data: { session, user: session.user }, error: null };
      },
      signOut: async () => {
        session = null;
        emit('SIGNED_OUT');
        return { error: null };
      },
    },
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => (session ? { data: { signedUrl: `https://fake.storage/${path}?token=t` }, error: null } : { data: null, error: { message: 'unauthorized' } }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };

  return { client, db, ADMIN_EMAIL, PASSWORD };
}
