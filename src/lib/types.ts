// Row types mirroring supabase/migrations/*.sql. Keep in sync with the schema.

export type AssetKind = 'image' | 'svg' | 'video' | 'audio' | 'pdf' | 'pptx' | 'data' | 'other';

export interface Asset {
  id: string;
  bucket: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  kind: AssetKind;
  title: string;
  description: string;
  category: string;
  tags: string[];
  version: number;
  archived: boolean;
  sha256?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetVersion {
  id: string;
  asset_id: string;
  version: number;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  note: string;
  created_at: string;
}

export interface SiteSettings {
  id: 1;
  project_title: string;
  short_title: string;
  affiliation: string;
  collaboration: string;
  team_md: string;
  motivation_md: string;
  objectives_md: string;
  hypothesis_md: string;
  architecture_md: string;
  architecture_asset_id: string | null;
  updated_at: string;
}

export interface ResearchThrust {
  id: string;
  slug: string;
  numeral: string;
  title: string;
  summary_md: string;
  formulation_md: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ComponentStatus = 'planned' | 'exploring' | 'in_progress' | 'paused' | 'complete' | 'dropped';

export interface ModelComponent {
  id: string;
  slug: string;
  thrust_id: string | null;
  title: string;
  summary: string;
  status: ComponentStatus;
  overview_md: string;
  motivation_md: string;
  architecture_md: string;
  implementation_md: string;
  training_config_md: string;
  results_md: string;
  limitations_md: string;
  planned_md: string;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type ExperimentStatus = 'planned' | 'running' | 'completed' | 'failed' | 'abandoned';

export interface Experiment {
  id: string;
  code: string;
  name: string;
  model_component_id: string | null;
  research_question: string;
  hypothesis: string;
  dataset: string;
  model_checkpoint: string;
  config_md: string;
  experiment_date: string | null;
  status: ExperimentStatus;
  baseline_md: string;
  observations_md: string;
  conclusions_md: string;
  limitations_md: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExperimentMetric {
  id: string;
  experiment_id: string;
  metric_name: string;
  condition_label: string;
  is_baseline: boolean;
  value: number | null;
  unit: string;
  higher_is_better: boolean | null;
  split: string;
  notes: string;
  sort_order: number;
  created_at: string;
}

export type WeeklyStatus = 'draft' | 'published';

export interface WeeklyUpdate {
  id: string;
  week_start: string;
  meeting_date: string | null;
  title: string;
  status: WeeklyStatus;
  research_focus: string;
  goals_md: string;
  summary_md: string;
  accomplishments_md: string;
  agenda_md: string;
  discussion_questions_md: string;
  implementation_changes_md: string;
  results_md: string;
  issues_md: string;
  failed_experiments_md: string;
  hypotheses_md: string;
  lessons_md: string;
  uncertainties_md: string;
  planned_experiments_md: string;
  priorities_md: string;
  followups_md: string;
  open_questions_md: string;
  discussion_notes_md: string;
  decisions_md: string;
  action_items_md: string;
  report_md: string;
  report_source: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyUpdateExperiment {
  weekly_update_id: string;
  experiment_id: string;
  note: string;
  sort_order: number;
}

export type DocumentCategory =
  | 'proposal' | 'proposal_slides' | 'weekly_slides' | 'design_doc' | 'architecture' | 'research_note' | 'other';

export interface DocumentRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: DocumentCategory;
  document_date: string | null;
  version: string;
  tags: string[];
  thrust_id: string | null;
  weekly_update_id: string | null;
  file_asset_id: string | null;
  preview_asset_id: string | null;
  body_md: string;
  important: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: string;
  file_asset_id: string | null;
  preview_asset_id: string | null;
  note: string;
  created_at: string;
}

export interface SurveyCategory {
  slug: string;
  title: string;
  description: string;
  sort_order: number;
}

export type ReadingStatus = 'to_read' | 'reading' | 'reviewed' | 'important';
export type PublicationStatus = 'published' | 'preprint' | 'under_review' | 'blog' | 'unknown';

export interface Paper {
  id: string;
  slug: string;
  title: string;
  authors: string;
  venue: string;
  year: number | null;
  publication_status: PublicationStatus;
  paper_url: string;
  project_url: string;
  code_url: string;
  tags: string[];
  summary_md: string;
  contributions_md: string;
  relevance_md: string;
  notes_md: string;
  reading_status: ReadingStatus;
  team_prior_work: boolean;
  source_note: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaperWithCategories extends Paper {
  paper_category_links: { category_slug: string }[];
}

export interface Milestone {
  id: string;
  slug: string;
  phase: string;
  title: string;
  description_md: string;
  evidence_md: string;
  target_date: string | null;
  status: 'planned' | 'active' | 'done' | 'deferred';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type EntityType = 'weekly_update' | 'experiment' | 'model_component' | 'document' | 'paper';
export type LinkRole = 'slides' | 'figure' | 'audio' | 'video' | 'comparison' | 'diagram' | 'attachment' | 'data';

export interface ContentAssetLink {
  id: string;
  asset_id: string;
  entity_type: EntityType;
  entity_id: string;
  role: LinkRole;
  group_key: string;
  label: string;
  caption: string;
  sort_order: number;
  created_at: string;
}

export interface ContentAssetLinkWithAsset extends ContentAssetLink {
  asset: Asset | null;
}

export interface AssetReference {
  entity_type: string;
  entity_id: string | null;
  title: string;
  via: string;
}
