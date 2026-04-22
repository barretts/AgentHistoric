#!/usr/bin/env node
// After `vite build`, emit a shell HTML per expert slug so GitHub Pages
// can serve /experts/<slug> directly. The shell is a copy of dist/index.html
// with the <title> replaced. All shells load the same SPA bundle and the
// Router picks the right page from window.location.pathname.

import {readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const srcDir = join(root, 'experts-source');
const distDir = join(root, 'dist');
const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');

const outExperts = join(distDir, 'experts');
mkdirSync(outExperts, {recursive: true});

// Rewrite asset URLs so they work from any depth (index already uses absolute
// /assets/... paths emitted by Vite with base: '/').
function shellFor(title) {
  return indexHtml.replace(
    /<title>[^<]*<\/title>/,
    `<title>${title} | Agent Historic</title>`,
  );
}

const slugs = readdirSync(srcDir)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''));

for (const slug of slugs) {
  const name = slug.charAt(0).toUpperCase() + slug.slice(1);
  // Emit both /experts/<slug>.html and /experts/<slug>/index.html so both
  // URL shapes work on GitHub Pages.
  writeFileSync(join(outExperts, `${slug}.html`), shellFor(name));
  mkdirSync(join(outExperts, slug), {recursive: true});
  writeFileSync(join(outExperts, slug, 'index.html'), shellFor(name));
}

// GitHub Pages 404 fallback: serve the SPA shell so unknown paths resolve
// client-side (Router renders landing for anything unrecognized).
copyFileSync(join(distDir, 'index.html'), join(distDir, '404.html'));

console.log(`emitted ${slugs.length} expert shells and 404.html`);
