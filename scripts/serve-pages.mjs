// Serve dist/ the way GitHub Pages does for a project site:
//   http://localhost:4173/<repo>/...  → files from dist/, unknown paths → 404.html
// Usage: BASE_PATH=/interactive-avs-portal/ node scripts/serve-pages.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const port = Number(process.argv[2] || 4173);
const dist = process.env.DIST_DIR || join(process.cwd(), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain' };

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  // Test-only: lets headless screenshots wait for async rendering.
  if (process.env.SCREENSHOT_DELAY_MS && url.endsWith('/__screenshot_delay.gif')) {
    await new Promise((r) => setTimeout(r, Number(process.env.SCREENSHOT_DELAY_MS)));
    res.writeHead(200, { 'content-type': 'image/gif' });
    res.end(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'));
    return;
  }
  if (!url.startsWith(base)) {
    res.writeHead(404).end('Not under base path');
    return;
  }
  const rel = normalize(url.slice(base.length)).replace(/^(\.\.[/\\])+/, '');
  let file = join(dist, rel || 'index.html');
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    const fallback = await readFile(join(dist, '404.html')).catch(() => readFile(join(dist, 'index.html')).catch(() => 'Not found'));
    res.writeHead(404, { 'content-type': types['.html'] });
    res.end(fallback);
  }
}).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}${base}`));
