// Pre-signed-in fake backend for screenshots. ALL DATA BELOW IS FAKE FIXTURE
// DATA used only to check layout; it is not research content.
import { createFakeSupabase } from '../unit/fakeSupabase';

const L = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fixture text for layout checks only.';
const fake = createFakeSupabase({
  site_settings: [{ id: 1, project_title: 'Fixture Project Title for Layout Checks', short_title: 'Fixture Project', affiliation: 'Fixture Lab, Fixture University', collaboration: 'Fixture Partner', team_md: '**Team:** Person A, Person B · **Advisor:** Person C', motivation_md: `${L}\n\n${L}`, objectives_md: '- Objective one\n- Objective two', hypothesis_md: L, architecture_md: '', architecture_asset_id: null }],
  research_thrusts: ['I', 'II', 'III'].map((n, i) => ({ id: `t${i}`, slug: `thrust-${i + 1}`, numeral: n, title: `Fixture thrust ${n}`, summary_md: L, formulation_md: '$$A = F(O_1, O_2, I(t))$$', sort_order: i })),
  model_components: Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, slug: `fixture-component-${i}`, thrust_id: `t${i % 3}`, title: `Fixture component ${i + 1}`, summary: 'One-line fixture summary of the component.', status: ['planned', 'in_progress', 'exploring'][i % 3], overview_md: L, motivation_md: L, architecture_md: '', implementation_md: '', training_config_md: '```yaml\nlr: 0.0\n```', results_md: '', limitations_md: '', planned_md: '', sort_order: i, published: true, updated_at: '2026-11-05T00:00:00Z' })),
  experiments: [{ id: 'e1', code: 'FIX-0001', name: 'Fixture experiment', model_component_id: 'c0', research_question: 'Fixture question?', hypothesis: 'Fixture hypothesis', dataset: 'fixture-set', model_checkpoint: 'fixture.ckpt', config_md: '', experiment_date: '2026-11-03', status: 'completed', baseline_md: '', observations_md: L, conclusions_md: L, limitations_md: '', published: true, updated_at: '2026-11-05T00:00:00Z' }],
  experiment_metrics: [
    { id: 'm1', experiment_id: 'e1', metric_name: 'Metric X', condition_label: 'Condition A', is_baseline: false, value: 1.0, unit: '', higher_is_better: false, split: 'fixture', notes: '', sort_order: 0 },
    { id: 'm2', experiment_id: 'e1', metric_name: 'Metric X', condition_label: 'Condition B', is_baseline: true, value: 2.0, unit: '', higher_is_better: false, split: 'fixture', notes: '', sort_order: 1 },
  ],
  weekly_updates: [{ id: 'w1', week_start: '2026-11-02', meeting_date: '2026-11-06', title: 'Fixture week title', status: 'draft', research_focus: 'Fixture focus line', goals_md: '- Goal one\n- Goal two', summary_md: L, accomplishments_md: '', agenda_md: '1. Item\n2. Item', discussion_questions_md: '', implementation_changes_md: '', results_md: '', issues_md: L, failed_experiments_md: '', hypotheses_md: '', lessons_md: '', uncertainties_md: '', planned_experiments_md: '', priorities_md: '', followups_md: '', open_questions_md: '', discussion_notes_md: '', decisions_md: '', action_items_md: '- [ ] Fixture action', created_at: '2026-11-05', updated_at: '2026-11-05T00:00:00Z' }],
  weekly_update_experiments: [{ weekly_update_id: 'w1', experiment_id: 'e1', note: 'Fixture note', sort_order: 0 }],
  weekly_update_components: [],
  documents: [],
  document_versions: [],
  survey_categories: ['Video-to-Audio Generation', 'Contact Sound and Foley Generation', 'Spatial Audio Rendering'].map((t, i) => ({ slug: `cat-${i}`, title: t, description: '', sort_order: i })),
  papers: Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, slug: `fixture-paper-${i}`, title: `Fixture Paper Title Number ${i + 1}`, authors: 'A. Author, B. Author', venue: 'Fixture Venue', year: 2026 - i, publication_status: i === 1 ? 'under_review' : 'published', paper_url: 'https://example.org', project_url: '', code_url: '', tags: ['fixture'], summary_md: L, contributions_md: '', relevance_md: '', notes_md: '', reading_status: ['to_read', 'important', 'reading', 'reviewed'][i], team_prior_work: i === 0, source_note: '', published: true, created_at: '2026-11-01' })),
  paper_category_links: [{ paper_id: 'p0', category_slug: 'cat-0' }, { paper_id: 'p1', category_slug: 'cat-1' }, { paper_id: 'p2', category_slug: 'cat-2' }, { paper_id: 'p3', category_slug: 'cat-0' }],
  milestones: [{ id: 'ms1', slug: 'q1', phase: 'Q1', title: 'Fixture milestone', description_md: '', evidence_md: '', target_date: null, status: 'planned', sort_order: 0 }],
  assets: [],
  asset_versions: [],
  content_asset_links: [],
});
void fake.client.auth.signInWithPassword({ email: fake.ADMIN_EMAIL, password: fake.PASSWORD });

export const supabase = fake.client;
