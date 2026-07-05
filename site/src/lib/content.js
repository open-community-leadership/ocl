import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';

const repoRoot = path.resolve(process.cwd(), '..');
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

const MODULE_DOC_SUFFIX = { README: '', 'self-guided': 'self-guided/', workshop: 'workshop/', 'mentor-guide': 'mentor-guide/' };

// Markdown in the repo links to sibling files the way GitHub browses them
// (`workshop.md`, `../../resources/...`). The site doesn't serve those paths
// directly — module sub-docs are their own routes and resources/ is a static
// asset dir — so every link gets remapped relative to the source file's
// repo-relative directory.
function resolveContentLink(href, fromDir) {
  if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) return href;

  const hashIdx = href.indexOf('#');
  const rawPath = hashIdx === -1 ? href : href.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : href.slice(hashIdx + 1);
  if (!rawPath) return href;

  const decoded = decodeURIComponent(rawPath);
  const resolved = path.posix.normalize(path.posix.join(fromDir, decoded)).replace(/\/+$/, '') || '.';
  const withHash = (url) => url + (hash ? `#${hash}` : '');

  const moduleDoc = resolved.match(/^modules\/([^/]+)\/(README|self-guided|workshop|mentor-guide)\.md$/);
  if (moduleDoc) {
    const [, slug, doc] = moduleDoc;
    return withHash(`${base}/modules/${slug}/${MODULE_DOC_SUFFIX[doc]}`);
  }

  if (resolved === 'modules' || resolved === 'modules/README.md') {
    return withHash(`${base}/modules/`);
  }

  const moduleDir = resolved.match(/^modules\/([^/]+)$/);
  if (moduleDir) {
    return withHash(`${base}/modules/${moduleDir[1]}/`);
  }

  if (resolved === 'POPCOM.md') {
    return withHash(`${base}/popcom/`);
  }

  if (resolved === 'CONTRIBUTING.md') {
    return withHash(`${base}/contributing/`);
  }

  if (resolved === 'research' || resolved === 'research/README.md') {
    return withHash(`${base}/research/`);
  }

  const interview = resolved.match(/^research\/interviews\/([^/]+)\.md$/);
  if (interview) {
    return withHash(`${base}/research/interviews/${interview[1]}/`);
  }

  if (resolved.startsWith('resources/')) {
    const encoded = resolved.split('/').map(encodeURIComponent).join('/');
    return withHash(`${base}/${encoded}`);
  }

  // Stray repo docs with no site route (LICENSE.md, CODE_OF_CONDUCT.md, ...)
  // fall back to the GitHub-rendered file rather than a dead relative path.
  const encoded = resolved.split('/').map(encodeURIComponent).join('/');
  return withHash(`https://github.com/open-community-leadership/ocl/blob/main/${encoded}`);
}

function renderer(fromDir) {
  return {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${resolveContentLink(href, fromDir)}"${titleAttr}>${text}</a>`;
    },
  };
}

function renderMarkdown(raw, fromDir) {
  return new Marked({ renderer: renderer(fromDir) }).parse(raw);
}

export function renderDoc(relPath) {
  const raw = fs.readFileSync(path.join(repoRoot, relPath), 'utf-8');
  return renderMarkdown(raw, path.posix.dirname(relPath));
}

// Folder READMEs end with a "*This folder is part of OCL...*" attribution
// line. Pages that append extra content (file listings, etc.) after the
// README body need that line to stay last, not get sandwiched in the middle.
const ATTRIBUTION_RE = /\n\n---\n\n(\*This folder is part of[\s\S]*)$/;

export function renderDocSplit(relPath) {
  const raw = fs.readFileSync(path.join(repoRoot, relPath), 'utf-8');
  const fromDir = path.posix.dirname(relPath);
  const match = raw.match(ATTRIBUTION_RE);
  if (!match) return { html: renderMarkdown(raw, fromDir), attributionHtml: '' };
  return {
    html: renderMarkdown(raw.slice(0, match.index), fromDir),
    attributionHtml: renderMarkdown(match[1], fromDir),
  };
}

export function listModules() {
  const dir = path.join(repoRoot, 'modules');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .filter((d) => fs.existsSync(path.join(dir, d.name, 'README.md')))
    .map((d) => {
      const raw = fs.readFileSync(path.join(dir, d.name, 'README.md'), 'utf-8');
      const title = raw.match(/^#\s+(.+)$/m)?.[1] ?? d.name;
      return { slug: d.name, title, html: renderMarkdown(raw, `modules/${d.name}`) };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function renderModuleDoc(slug, doc) {
  const file = path.join(repoRoot, 'modules', slug, `${doc}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  const title = raw.match(/^#\s+(.+)$/m)?.[1] ?? doc;
  return { slug, title, html: renderMarkdown(raw, `modules/${slug}`) };
}

function readDocMeta(readmePath, fallbackName) {
  if (!fs.existsSync(readmePath)) return { title: fallbackName, description: '' };
  const raw = fs.readFileSync(readmePath, 'utf-8');
  const title = raw.match(/^#\s+(.+)$/m)?.[1] ?? fallbackName;
  const description = raw.match(/^#.*\n+([^\n#].*)$/m)?.[1]?.trim() ?? '';
  return { title, description };
}

// Recursively lists every non-README file under a repo-relative directory,
// so index pages can show what's actually there instead of just a blurb.
function walkFiles(relDir) {
  const abs = path.join(repoRoot, relDir);
  const files = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const childRel = path.posix.join(relDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(childRel));
    } else if (entry.name !== 'README.md') {
      files.push(childRel);
    }
  }
  return files.sort();
}

export function resourceHref(relPath) {
  const encoded = relPath.split('/').map(encodeURIComponent).join('/');
  return `${base}/${encoded}`;
}

export function listResourceSections() {
  const dir = path.join(repoRoot, 'resources');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const sectionRel = `resources/${d.name}`;
      const { title, description } = readDocMeta(path.join(dir, d.name, 'README.md'), d.name);
      const files = walkFiles(sectionRel).map((relPath) => ({
        relPath,
        name: path.posix.relative(sectionRel, relPath),
        href: resourceHref(relPath),
      }));
      return { slug: d.name, title, description, files };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function listInterviews() {
  const dir = path.join(repoRoot, 'research', 'interviews');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.md') && d.name !== 'README.md')
    .map((d) => {
      const slug = d.name.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(dir, d.name), 'utf-8');
      const title = raw.match(/^#\s+(.+)$/m)?.[1] ?? slug;
      return { slug, title };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function renderInterview(slug) {
  const file = path.join(repoRoot, 'research', 'interviews', `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf-8');
  const title = raw.match(/^#\s+(.+)$/m)?.[1] ?? slug;
  return { slug, title, html: renderMarkdown(raw, 'research/interviews') };
}
