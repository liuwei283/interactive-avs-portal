import type {
  ComponentStatus, DocumentCategory, ExperimentStatus, LinkRole, PublicationStatus, ReadingStatus,
} from './types';

export const componentStatusLabel: Record<ComponentStatus, string> = {
  planned: 'Planned',
  exploring: 'Exploring',
  in_progress: 'In progress',
  paused: 'Paused',
  complete: 'Complete',
  dropped: 'Dropped',
};

export const experimentStatusLabel: Record<ExperimentStatus, string> = {
  planned: 'Planned',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  abandoned: 'Abandoned',
};

export const readingStatusLabel: Record<ReadingStatus, string> = {
  to_read: 'To Read',
  reading: 'Reading',
  reviewed: 'Reviewed',
  important: 'Important',
};

export const publicationStatusLabel: Record<PublicationStatus, string> = {
  published: 'Published',
  preprint: 'Preprint',
  under_review: 'Under review',
  blog: 'Blog / report',
  unknown: 'Unverified',
};

export const documentCategoryLabel: Record<DocumentCategory, string> = {
  proposal: 'Research proposals',
  proposal_slides: 'Proposal slides',
  weekly_slides: 'Weekly meeting slides',
  design_doc: 'Technical design documents',
  architecture: 'Architecture diagrams',
  research_note: 'Research notes',
  other: 'Other project files',
};

export const linkRoleLabel: Record<LinkRole, string> = {
  slides: 'Slides',
  figure: 'Figure',
  audio: 'Audio',
  video: 'Video',
  comparison: 'Comparison',
  diagram: 'Architecture diagram',
  attachment: 'Attachment',
  data: 'Data',
};

/** Tone used by <StatusBadge>. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

export function toneForStatus(status: string): Tone {
  switch (status) {
    case 'complete':
    case 'completed':
    case 'done':
    case 'published':
    case 'reviewed':
      return 'success';
    case 'in_progress':
    case 'running':
    case 'active':
    case 'reading':
      return 'info';
    case 'exploring':
    case 'important':
      return 'accent';
    case 'paused':
    case 'draft':
    case 'deferred':
      return 'warning';
    case 'failed':
    case 'abandoned':
    case 'dropped':
      return 'danger';
    default:
      return 'neutral';
  }
}
