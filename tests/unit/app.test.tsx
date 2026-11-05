// End-to-end UI flows of the real <App> against an in-memory Supabase fake.
// Fixture rows below are TEST DATA ONLY; they are never shipped or seeded.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createFakeSupabase } from './fakeSupabase';

const fixture = () => ({
  site_settings: [{ id: 1, project_title: 'Test Project Title', short_title: 'Test Project', affiliation: 'Test Lab', collaboration: 'Test Partner', team_md: '', motivation_md: 'Test motivation paragraph.', objectives_md: '', hypothesis_md: '', architecture_md: '', architecture_asset_id: null }],
  research_thrusts: [{ id: 't1', slug: 'thrust-1', numeral: 'I', title: 'Test Thrust One', summary_md: '', formulation_md: '$A = F(x)$', sort_order: 1 }],
  model_components: [{ id: 'c1', slug: 'test-component', thrust_id: 't1', title: 'Test Component', summary: 'A test component', status: 'planned', overview_md: '', motivation_md: '', architecture_md: '', implementation_md: '', training_config_md: '', results_md: '', limitations_md: '', planned_md: '', sort_order: 1, published: true, updated_at: '2026-11-05T00:00:00Z' }],
  experiments: [{ id: 'e1', code: 'EXP-0001', name: 'Test experiment', model_component_id: 'c1', research_question: 'Does the test work?', hypothesis: '', dataset: '', model_checkpoint: '', config_md: '', experiment_date: '2026-11-03', status: 'planned', baseline_md: '', observations_md: '', conclusions_md: '', limitations_md: '', published: true, updated_at: '2026-11-05T00:00:00Z' }],
  experiment_metrics: [],
  weekly_updates: [],
  weekly_update_experiments: [],
  weekly_update_components: [],
  documents: [],
  document_versions: [],
  survey_categories: [{ slug: 'v2a', title: 'Video-to-Audio Generation', description: '', sort_order: 1 }, { slug: 'spatial', title: 'Spatial Audio Rendering', description: '', sort_order: 2 }],
  papers: [
    { id: 'p1', slug: 'paper-alpha', title: 'Alpha Paper', authors: 'A. Author', venue: 'TestConf', year: 2025, publication_status: 'published', paper_url: '', project_url: '', code_url: '', tags: [], summary_md: '', contributions_md: '', relevance_md: '', notes_md: '', reading_status: 'to_read', team_prior_work: false, source_note: '', published: true, created_at: '2026-11-01' },
    { id: 'p2', slug: 'paper-beta', title: 'Beta Paper', authors: 'B. Author', venue: 'TestConf', year: 2024, publication_status: 'published', paper_url: '', project_url: '', code_url: '', tags: [], summary_md: '', contributions_md: '', relevance_md: '', notes_md: '', reading_status: 'important', team_prior_work: false, source_note: '', published: true, created_at: '2026-11-01' },
  ],
  paper_category_links: [{ paper_id: 'p1', category_slug: 'v2a' }, { paper_id: 'p2', category_slug: 'spatial' }],
  milestones: [],
  assets: [],
  asset_versions: [],
  content_asset_links: [],
});

const fake = vi.hoisted(() => ({ current: null as null | ReturnType<typeof createFakeSupabase> }));
vi.mock('../../src/lib/supabase', () => ({
  get supabase() {
    return fake.current!.client;
  },
}));

import App from '../../src/App';
import { AuthProvider } from '../../src/lib/auth';

function renderApp(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function login(password = fake.current!.PASSWORD, username = 'admin') {
  await screen.findByRole('button', { name: 'Sign in' });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => {
  fake.current = createFakeSupabase(fixture());
  window.scrollTo = () => {};
});
afterEach(() => cleanup());

describe('authentication and protected routes', () => {
  it('redirects unauthenticated visitors to the login page', async () => {
    renderApp('/progress');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Weekly Progress')).toBeNull();
  });

  it('shows clear errors for a wrong password and an unknown username', async () => {
    renderApp('/');
    await login('wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.');
    await login(fake.current!.PASSWORD, 'someone');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incorrect username or password.'));
  });

  it('logs in, returns to the requested page, and logs out', async () => {
    renderApp('/survey');
    await login();
    expect(await screen.findByRole('heading', { name: 'Survey' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Log out' })[0]);
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Survey' })).toBeNull();
  });
});

describe('navigation', () => {
  it('reaches all five sections from the main navigation', async () => {
    renderApp('/');
    await login();
    expect(await screen.findByRole('heading', { name: 'Test Project Title' })).toBeInTheDocument();
    expect(screen.getByText('Test motivation paragraph.')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const go = async (label: string, heading: string) => {
      fireEvent.click(within(nav).getByRole('link', { name: label }));
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    };
    await go('Survey', 'Survey');
    await go('Documents', 'Documents');
    await go('Weekly Progress', 'Weekly Progress');
    await go('Models', 'Models');
    expect(screen.getByText('Test Thrust One')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('link', { name: /Test Component/ })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Test Component' })).toBeInTheDocument();
    await go('Overview', 'Test Project Title');
  });

  it('shows a not-found state for an unknown week', async () => {
    renderApp('/progress/2030-01-07');
    await login();
    expect(await screen.findByText(/Weekly update for 2030-01-07 not found/)).toBeInTheDocument();
  });
});

describe('survey', () => {
  it('filters by category and search', async () => {
    renderApp('/survey');
    await login();
    expect(await screen.findByText('Alpha Paper')).toBeInTheDocument();
    expect(screen.getByText('Beta Paper')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Spatial Audio Rendering/ }));
    await waitFor(() => expect(screen.queryByText('Alpha Paper')).toBeNull());
    expect(screen.getByText('Beta Paper')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /All papers/ }));
    fireEvent.change(screen.getByLabelText('Search papers'), { target: { value: 'alpha' } });
    await waitFor(() => expect(screen.queryByText('Beta Paper')).toBeNull());
    expect(screen.getByText('Alpha Paper')).toBeInTheDocument();
  });
});

describe('weekly update workflow', () => {
  it('creates a week from any date, edits, links an experiment, publishes, and shows it in the index and on the model page', async () => {
    renderApp('/admin/weekly/new');
    await login();
    const date = await screen.findByLabelText('Any date in the week');
    fireEvent.change(date, { target: { value: '2026-11-05' } }); // a Thursday
    expect(await screen.findByText(/\/progress\/2026-11-02/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create draft and continue' }));

    expect(await screen.findByRole('heading', { level: 1, name: /Week of Nov 2, 2026/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'A. Overview' }));
    fireEvent.change(screen.getByLabelText('Progress summary'), { target: { value: 'Wrote the **test** summary.' } });

    fireEvent.click(screen.getByRole('tab', { name: 'C. Experiments & results' }));
    const pick = await screen.findByLabelText('Experiment to link');
    await waitFor(() => expect(within(pick).getByRole('option', { name: /EXP-0001/ })).toBeInTheDocument());
    fireEvent.change(pick, { target: { value: 'e1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(await screen.findByRole('button', { name: 'Unlink' })).toBeInTheDocument();
    expect(fake.current!.db.weekly_update_experiments).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    // Lands on the public weekly page.
    expect(await screen.findByText('A. Weekly overview', { selector: 'h2' })).toBeInTheDocument();
    expect(await screen.findByText('test')).toBeInTheDocument();
    expect(screen.getAllByText('EXP-0001').length).toBeGreaterThan(0);
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(fake.current!.db.weekly_updates[0]).toMatchObject({ week_start: '2026-11-02', status: 'published' });

    // Appears in the index.
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Weekly Progress' }));
    expect(await screen.findByText('Week of Nov 2, 2026')).toBeInTheDocument();

    // Reverse link on the model component page.
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Models' }));
    fireEvent.click((await screen.findAllByRole('link', { name: /Test Component/ }))[0]);
    const weekly = await screen.findByRole('heading', { name: 'Related weekly updates' });
    expect(within(weekly.closest('section')!).getByText('Week of Nov 2, 2026')).toBeInTheDocument();
  });

  it('refuses a second page for the same week', async () => {
    fake.current!.db.weekly_updates.push({ id: 'w0', week_start: '2026-11-02', status: 'draft', title: '', created_at: '', updated_at: '' });
    renderApp('/admin/weekly/new');
    await login();
    fireEvent.change(await screen.findByLabelText('Any date in the week'), { target: { value: '2026-11-04' } });
    expect(await screen.findByText(/already has a page/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create draft and continue' })).toBeNull();
  });
});

describe('agent-written weekly report', () => {
  it('renders free-form report with A/B audio and metrics blocks, and hides empty A–F sections', async () => {
    const A1 = '11111111-1111-4111-8111-111111111111';
    const A2 = '22222222-2222-4222-8222-222222222222';
    const asset = (id: string, name: string) => ({ id, bucket: 'research-files', storage_path: `weekly/${name}`, filename: name, mime_type: 'audio/wav', size_bytes: 10, kind: 'audio', title: name, description: '', category: 'x', tags: [], version: 1, archived: false, created_at: '', updated_at: '' });
    fake.current!.db.assets.push(asset(A1, 'ours.wav'), asset(A2, 'base.wav'));
    fake.current!.db.weekly_updates.push({
      id: 'w9', week_start: '2026-11-09', status: 'draft', title: 'Agent week', created_at: '', updated_at: '2026-11-10',
      report_md: `## Highlights\nSome text.\n\n\`\`\`compare-audio\ntitle: Mug tap\nOurs: asset:${A1}\nBaseline: MMAudio: asset:${A2}\n\`\`\`\n\n\`\`\`metrics\ntitle: Scores\ncondition,FAD\nOurs,1.5\n\`\`\`\n`,
      report_source: '/x', summary_md: '', goals_md: '', accomplishments_md: '', agenda_md: '', discussion_questions_md: '', implementation_changes_md: '', results_md: '', issues_md: '', failed_experiments_md: '', hypotheses_md: '', lessons_md: '', uncertainties_md: '', planned_experiments_md: '', priorities_md: '', followups_md: '', open_questions_md: '', discussion_notes_md: '', decisions_md: '', action_items_md: '', research_focus: '',
    });
    renderApp('/progress/2026-11-09');
    await login();
    expect(await screen.findByRole('heading', { level: 2, name: 'Highlights' })).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /Baseline: MMAudio/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Ours/ })).toBeInTheDocument();
    expect(screen.getByText('Scores')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Ours' })).toBeInTheDocument();
    expect(screen.queryByText('A. Weekly overview')).toBeNull();
    expect(screen.getByRole('link', { name: 'Highlights' })).toHaveAttribute('href', '#r-highlights');
  });
});

describe('experiment records', () => {
  it('creates an experiment with a suggested stable ID under a component', async () => {
    renderApp('/admin/experiments/new?component=c1');
    await login();
    const code = await screen.findByLabelText('Experiment ID');
    await waitFor(() => expect(code).toHaveValue('EXP-0002'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Second test run' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));
    await waitFor(() => expect(fake.current!.db.experiments.find((e) => e.code === 'EXP-0002')).toMatchObject({ name: 'Second test run', model_component_id: 'c1' }));
  });
});
