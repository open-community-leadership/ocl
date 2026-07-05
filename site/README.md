# OCL website

Static site for Open Community Leadership, built with Astro. Content pages render markdown directly from the repo root (`docs/`, `modules/`), so the site never drifts from the repository.

## Local development

```
cd site
npm install
npm run dev
```

## How it deploys

Pushing to `main` triggers `.github/workflows/site.yml`, which builds the site and publishes it to GitHub Pages at https://open-community-leadership.github.io/ocl/. One-time setup: in repo Settings → Pages, set the source to "GitHub Actions".

## Adding content

- New module: create `modules/NN-name/README.md` — it appears on the site automatically (folders starting with `_` are skipped).
- Framework docs: edit `docs/POPCOM.md` or `docs/framework.md`.
- Landing page: `site/src/pages/index.astro`.

## License

Like everything in this repository, the site and its content are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The license is linked in the footer of every page and in each page's `<link rel="license">`.
