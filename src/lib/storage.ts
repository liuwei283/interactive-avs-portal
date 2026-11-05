import DOMPurify from 'dompurify';
import * as tus from 'tus-js-client';
import { config } from './config';
import { supabase } from './supabase';
import { buildStoragePath, validateFile } from './files';
import type { Asset, AssetKind, AssetReference } from './types';

export interface UploadOptions {
  folder: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  allowedKinds?: AssetKind[];
}

export interface UploadedObject {
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  kind: AssetKind;
}

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session has expired. Please sign in again.');
  return token;
}

/** Strip scripts / event handlers / foreign objects from an SVG before upload. */
export async function sanitizeSvgFile(file: File): Promise<File> {
  const text = await file.text();
  const clean = DOMPurify.sanitize(text, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script'],
  });
  if (!clean.trim().startsWith('<svg')) throw new Error(`"${file.name}" is not a valid SVG image.`);
  return new File([clean], file.name, { type: 'image/svg+xml' });
}

function xhrUpload(path: string, file: Blob, mime: string, token: string, opts: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', config.supabaseAnonKey);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(1);
        resolve();
      } else {
        let msg = `Upload failed (HTTP ${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText);
          msg = body.message || body.error || msg;
        } catch {
          /* keep default */
        }
        if (xhr.status === 413 || /maximum allowed size|too large/i.test(msg)) msg = 'The file exceeds the storage size limit.';
        if (xhr.status === 403 || /row-level security|unauthorized/i.test(msg)) msg = 'Not authorized to upload. Sign in again as admin.';
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    opts.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}

function tusUpload(path: string, file: Blob, mime: string, token: string, opts: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${config.supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, apikey: config.supabaseAnonKey, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: config.bucket, objectName: path, contentType: mime, cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB chunks
      onError: (err) => reject(new Error(`Resumable upload failed: ${err.message}`)),
      onProgress: (sent, total) => opts.onProgress?.(total ? sent / total : 0),
      onSuccess: () => {
        opts.onProgress?.(1);
        resolve();
      },
    });
    opts.signal?.addEventListener('abort', () => {
      void upload.abort(true);
      reject(new DOMException('Upload cancelled', 'AbortError'));
    });
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
}

/** Validate and upload one file to the private bucket. Does not create an `assets` row. */
export async function uploadObject(original: File, opts: UploadOptions): Promise<UploadedObject> {
  const maxBytes = config.maxUploadMb * 1024 * 1024;
  const v = validateFile(original, maxBytes, opts.allowedKinds);
  if (!v.ok) throw new Error(v.error);
  const file = v.kind === 'svg' ? await sanitizeSvgFile(original) : original;
  const path = buildStoragePath(opts.folder, original.name);
  const token = await accessToken();
  if (file.size >= config.resumableThresholdBytes) {
    await tusUpload(path, file, v.mime!, token, opts);
  } else {
    await xhrUpload(path, file, v.mime!, token, opts);
  }
  return { storage_path: path, filename: original.name, mime_type: v.mime!, size_bytes: file.size, kind: v.kind! };
}

export interface NewAssetMeta {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
}

/** Upload a file and register it in the `assets` table. Rolls back the object on failure. */
export async function createAsset(file: File, meta: NewAssetMeta, opts: UploadOptions): Promise<Asset> {
  const obj = await uploadObject(file, opts);
  const { data, error } = await supabase
    .from('assets')
    .insert({
      ...obj,
      bucket: config.bucket,
      title: meta.title?.trim() || file.name.replace(/\.[^.]+$/, ''),
      description: meta.description ?? '',
      category: meta.category || 'general',
      tags: meta.tags ?? [],
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(config.bucket).remove([obj.storage_path]);
    throw new Error(`File uploaded but metadata could not be saved: ${error.message}`);
  }
  return data as Asset;
}

/**
 * Replace the file behind an asset while keeping its id, so every page,
 * experiment and Markdown reference keeps working. The previous file is
 * kept in storage and recorded in asset_versions.
 */
export async function replaceAssetFile(asset: Asset, file: File, note: string, opts: UploadOptions): Promise<Asset> {
  const obj = await uploadObject(file, { ...opts, allowedKinds: opts.allowedKinds });
  const { error: vErr } = await supabase.from('asset_versions').insert({
    asset_id: asset.id,
    version: asset.version,
    storage_path: asset.storage_path,
    filename: asset.filename,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    note,
  });
  if (vErr) {
    await supabase.storage.from(config.bucket).remove([obj.storage_path]);
    throw new Error(`Could not record version history: ${vErr.message}`);
  }
  const { data, error } = await supabase
    .from('assets')
    .update({ ...obj, version: asset.version + 1 })
    .eq('id', asset.id)
    .select()
    .single();
  if (error) throw new Error(`Could not update asset: ${error.message}`);
  return data as Asset;
}

export async function assetReferences(assetId: string): Promise<AssetReference[]> {
  const { data, error } = await supabase.rpc('asset_references', { p_asset: assetId });
  if (error) throw new Error(error.message);
  return (data ?? []) as AssetReference[];
}

/**
 * Delete an asset only if nothing references it (attachments, documents,
 * inline Markdown). Removes the current file and all previous versions.
 */
export async function deleteAsset(asset: Asset): Promise<void> {
  const refs = await assetReferences(asset.id);
  if (refs.length) {
    throw new Error(
      `This file is still used by: ${refs.map((r) => `${r.title || r.entity_type} (${r.via})`).join('; ')}. Remove those references first, or archive the file instead.`,
    );
  }
  const { data: versions } = await supabase.from('asset_versions').select('storage_path').eq('asset_id', asset.id);
  const { error } = await supabase.from('assets').delete().eq('id', asset.id);
  if (error) throw new Error(error.message);
  const paths = [asset.storage_path, ...((versions ?? []) as { storage_path: string }[]).map((v) => v.storage_path)];
  const { error: sErr } = await supabase.storage.from(config.bucket).remove(paths);
  if (sErr) throw new Error(`Metadata deleted, but removing stored files failed: ${sErr.message}`);
}

/** Short-lived signed URL for a private object. */
export async function signedUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(config.bucket)
    .createSignedUrl(path, config.signedUrlSeconds, download ? { download } : undefined);
  if (error || !data) throw new Error(error?.message ?? 'Could not create a signed URL.');
  return data.signedUrl;
}
