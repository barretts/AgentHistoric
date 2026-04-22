# site/

This directory is the GitHub Pages artifact root used by `.github/workflows/deploy-pages.yml`.

**Do not edit `site/index.html` or `site/assets/` directly** — they are regenerated from `src/` on every deploy (the workflow runs `rm -rf site/*` then copies `dist/*` in). These paths are gitignored.

Tracked, preserved-across-builds content:

- `CNAME` — custom domain
- `experts/` — static expert pages served alongside the React app
- `README.md` — this file

To change the app itself, edit `src/` or the root `index.html` and push to `main`.
