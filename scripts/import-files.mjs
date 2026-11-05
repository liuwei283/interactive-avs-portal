#!/usr/bin/env node
// Upload existing local files (proposal PDF, slides, ...) into the PRIVATE
// storage bucket and register them as Documents. Signs in as admin.
//
//   npm run import:files                       # uses private/seed/files.mjs
//   npm run import:files -- --file my-files.mjs --replace
//
// Without --replace, documents whose slug already exists are skipped.
import { readFileSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { adminClient, check } from './lib/admin-client.mjs';

const args = process.argv.slice(2);
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : 'private/seed/files.mjs';
const replace = args.includes('--replace');
const MAX = 50 * 1024 * 1024;
const TYPES = {
  '.pdf': ['pdf', 'application/pdf'],
  '.pptx': ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.png': ['image', 'image/png'], '.jpg': ['image', 'image/jpeg'], '.jpeg': ['image', 'image/jpeg'], '.webp': ['image', 'image/webp'],
  '.mp4': ['video', 'video/mp4'], '.webm': ['video', 'video/webm'],
  '.wav': ['audio', 'audio/wav'], '.mp3': ['audio', 'audio/mpeg'], '.flac': ['audio', 'audio/flac'],
  '.json': ['data', 'application/json'], '.csv': ['data', 'text/csv'],
};

const { documents } = await import(pathToFileURL(resolve(fileArg)).href);
const db = await adminClient();

async function uploadAsset(path, category, title) {
  const abs = resolve(path);
  const ext = extname(abs).toLowerCase();
  const t = TYPES[ext];
  if (!t) throw new Error(`${path}: unsupported type ${ext}`);
  const size = statSync(abs).size;
  if (size > MAX) throw new Error(`${path}: ${(size / 1e6).toFixed(1)} MB exceeds the 50 MB limit`);
  const name = basename(abs, ext).replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
  const now = new Date();
  const storagePath = `documents/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}/${randomBytes(6).toString('hex')}-${name}${ext}`;
  check(await db.storage.from('research-files').upload(storagePath, readFileSync(abs), { contentType: t[1], upsert: false }), `upload ${path}`);
  const asset = check(
    await db.from('assets').insert({ storage_path: storagePath, filename: basename(abs), mime_type: t[1], size_bytes: size, kind: t[0], title, category }).select().single(),
    `asset row for ${path}`,
  );
  console.log(`  uploaded ${basename(abs)} (${(size / 1e6).toFixed(1)} MB)`);
  return asset;
}

for (const d of documents) {
  const existing = check(await db.from('documents').select('id').eq('slug', d.slug).maybeSingle(), 'lookup');
  if (existing && !replace) {
    console.log(`skip ${d.slug} (exists; use --replace to upload a new version)`);
    continue;
  }
  console.log(`import ${d.slug}`);
  const file = await uploadAsset(d.file, 'document', d.title);
  const preview = d.preview ? await uploadAsset(d.preview, 'document', `${d.title} (PDF preview)`) : null;
  const row = {
    slug: d.slug, title: d.title, description: d.description ?? '', category: d.category, version: d.version ?? 'v1',
    document_date: d.document_date ?? null, tags: d.tags ?? [], important: !!d.important,
    file_asset_id: file.id, preview_asset_id: preview?.id ?? null,
  };
  if (existing) {
    const old = check(await db.from('documents').select('*').eq('id', existing.id).single(), 'read old');
    check(await db.from('document_versions').insert({ document_id: old.id, version: old.version, file_asset_id: old.file_asset_id, preview_asset_id: old.preview_asset_id, note: 'Replaced by import-files' }), 'version history');
    check(await db.from('documents').update(row).eq('id', existing.id), 'update document');
  } else {
    check(await db.from('documents').insert(row), 'insert document');
  }
}
console.log('Done.');
process.exit(0);
