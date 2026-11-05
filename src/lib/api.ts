import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { signedUrl } from './storage';
import { config } from './config';
import type {
  Asset, AssetVersion, ContentAssetLink, ContentAssetLinkWithAsset, DocumentRow, DocumentVersion, EntityType,
  Experiment, ExperimentMetric, Milestone, ModelComponent, PaperWithCategories, ResearchThrust, SiteSettings,
  SurveyCategory, WeeklyUpdate, WeeklyUpdateExperiment,
} from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// --------------------------------------------------------------------- keys
export const qk = {
  settings: ['site_settings'] as const,
  thrusts: ['research_thrusts'] as const,
  components: ['model_components'] as const,
  experiments: ['experiments'] as const,
  metrics: (ids: string[]) => ['experiment_metrics', ...ids] as const,
  weekly: ['weekly_updates'] as const,
  weeklyExperiments: ['weekly_update_experiments'] as const,
  weeklyComponents: ['weekly_update_components'] as const,
  documents: ['documents'] as const,
  documentVersions: (id: string) => ['document_versions', id] as const,
  papers: ['papers'] as const,
  categories: ['survey_categories'] as const,
  milestones: ['milestones'] as const,
  assets: ['assets'] as const,
  asset: (id: string) => ['assets', id] as const,
  assetVersions: (id: string) => ['asset_versions', id] as const,
  attachments: (type: EntityType, id: string) => ['content_asset_links', type, id] as const,
  signed: (path: string, download?: string) => ['signed', path, download ?? ''] as const,
};

/** Invalidate everything after an admin edit (data volume is small). */
export function invalidateAll(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'signed' });
}

// ------------------------------------------------------------------ queries
export function useSiteSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async () => unwrap(await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()) as SiteSettings | null,
  });
}

export function useThrusts() {
  return useQuery({
    queryKey: qk.thrusts,
    queryFn: async () =>
      unwrap(await supabase.from('research_thrusts').select('*').order('sort_order').order('title')) as ResearchThrust[],
  });
}

export function useModelComponents() {
  return useQuery({
    queryKey: qk.components,
    queryFn: async () =>
      unwrap(await supabase.from('model_components').select('*').order('sort_order').order('title')) as ModelComponent[],
  });
}

export function useExperiments() {
  return useQuery({
    queryKey: qk.experiments,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('experiments')
          .select('*')
          .order('experiment_date', { ascending: false, nullsFirst: false })
          .order('code', { ascending: false }),
      ) as Experiment[],
  });
}

export function useMetrics(experimentIds: string[]) {
  const ids = [...experimentIds].sort();
  return useQuery({
    queryKey: qk.metrics(ids),
    enabled: ids.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase.from('experiment_metrics').select('*').in('experiment_id', ids).order('sort_order').order('metric_name'),
      ) as ExperimentMetric[],
  });
}

export function useWeeklyUpdates() {
  return useQuery({
    queryKey: qk.weekly,
    queryFn: async () =>
      unwrap(await supabase.from('weekly_updates').select('*').order('week_start', { ascending: false })) as WeeklyUpdate[],
  });
}

export function useWeeklyExperimentLinks() {
  return useQuery({
    queryKey: qk.weeklyExperiments,
    queryFn: async () =>
      unwrap(await supabase.from('weekly_update_experiments').select('*').order('sort_order')) as WeeklyUpdateExperiment[],
  });
}

export function useWeeklyComponentLinks() {
  return useQuery({
    queryKey: qk.weeklyComponents,
    queryFn: async () =>
      unwrap(await supabase.from('weekly_update_components').select('*')) as {
        weekly_update_id: string;
        model_component_id: string;
      }[],
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: qk.documents,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('documents')
          .select('*')
          .order('document_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false }),
      ) as DocumentRow[],
  });
}

export function useDocumentVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: qk.documentVersions(documentId ?? ''),
    enabled: !!documentId,
    queryFn: async () =>
      unwrap(
        await supabase.from('document_versions').select('*').eq('document_id', documentId!).order('created_at', { ascending: false }),
      ) as DocumentVersion[],
  });
}

export function usePapers() {
  return useQuery({
    queryKey: qk.papers,
    queryFn: async () =>
      unwrap(
        await supabase.from('papers').select('*, paper_category_links(category_slug)').order('year', { ascending: false, nullsFirst: false }),
      ) as PaperWithCategories[],
  });
}

export function useSurveyCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () =>
      unwrap(await supabase.from('survey_categories').select('*').order('sort_order').order('title')) as SurveyCategory[],
  });
}

export function useMilestones() {
  return useQuery({
    queryKey: qk.milestones,
    queryFn: async () =>
      unwrap(await supabase.from('milestones').select('*').order('sort_order').order('title')) as Milestone[],
  });
}

export function useAssets() {
  return useQuery({
    queryKey: qk.assets,
    queryFn: async () =>
      unwrap(await supabase.from('assets').select('*').order('created_at', { ascending: false })) as Asset[],
  });
}

export function useAsset(id: string | null | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.asset(id ?? ''),
    enabled: !!id,
    initialData: () => (qc.getQueryData(qk.assets) as Asset[] | undefined)?.find((a) => a.id === id),
    queryFn: async () => unwrap(await supabase.from('assets').select('*').eq('id', id!).maybeSingle()) as Asset | null,
  });
}

export function useAssetVersions(id: string | undefined) {
  return useQuery({
    queryKey: qk.assetVersions(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      unwrap(await supabase.from('asset_versions').select('*').eq('asset_id', id!).order('version', { ascending: false })) as AssetVersion[],
  });
}

export function useAttachments(type: EntityType, id: string | undefined) {
  return useQuery({
    queryKey: qk.attachments(type, id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from('content_asset_links')
          .select('*, asset:assets(*)')
          .eq('entity_type', type)
          .eq('entity_id', id!)
          .order('sort_order')
          .order('created_at'),
      ) as ContentAssetLinkWithAsset[];
      return rows;
    },
  });
}

/** Attachments for many entities of one type at once (e.g. all experiments of a component). */
export function useAttachmentsFor(type: EntityType, ids: string[]) {
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: ['content_asset_links', type, 'many', ...sorted],
    enabled: sorted.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('content_asset_links')
          .select('*, asset:assets(*)')
          .eq('entity_type', type)
          .in('entity_id', sorted)
          .order('sort_order'),
      ) as ContentAssetLinkWithAsset[],
  });
}

/** Signed URL for a private object, cached for slightly less than its lifetime. */
export function useSignedUrl(path: string | null | undefined, download?: string) {
  return useQuery({
    queryKey: qk.signed(path ?? '', download),
    enabled: !!path,
    staleTime: (config.signedUrlSeconds - 300) * 1000,
    gcTime: (config.signedUrlSeconds - 300) * 1000,
    queryFn: () => signedUrl(path!, download),
  });
}

// ---------------------------------------------------------------- mutations
export async function saveAttachment(row: Partial<ContentAssetLink> & Pick<ContentAssetLink, 'asset_id' | 'entity_type' | 'entity_id'>) {
  const { id, ...rest } = row;
  const res = id
    ? await supabase.from('content_asset_links').update(rest).eq('id', id)
    : await supabase.from('content_asset_links').insert(rest);
  if (res.error) throw new Error(res.error.message);
}

export async function removeAttachment(id: string) {
  const { error } = await supabase.from('content_asset_links').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
