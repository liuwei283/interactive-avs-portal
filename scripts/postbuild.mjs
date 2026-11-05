// GitHub Pages helpers, run after `vite build`:
//  * 404.html = index.html so deep links like /<repo>/progress/2026-11-02
//    load the single-page app (Pages serves 404.html for unknown paths).
//  * .nojekyll so files are served as-is.
//  * then run the bundle security scan.
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dist = join(process.cwd(), 'dist');
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
console.log('postbuild: wrote dist/404.html and dist/.nojekyll');
execFileSync(process.execPath, [join(process.cwd(), 'scripts/check-bundle.mjs')], { stdio: 'inherit' });
