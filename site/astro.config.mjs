import { defineConfig } from 'astro/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Page content (modules/, resources/, research/, events/, POPCOM.md, ...) is
// read straight off disk from the repo root, one level above this project —
// see site/src/lib/content.js. Vite's dev server only watches files inside
// its own root by default, so edits to those repo-root files would sit
// invisible until a manual restart. This plugin adds them to the watcher and
// forces a full reload when they change.
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const watchPaths = ['modules', 'resources', 'research', 'events', 'POPCOM.md', 'CONTRIBUTING.md'].map((p) =>
  path.join(repoRoot, p),
);

function watchRepoContent() {
  return {
    name: 'watch-repo-content',
    configureServer(server) {
      watchPaths.forEach((p) => server.watcher.add(p));
      const onChange = (file) => {
        if (watchPaths.some((p) => file.startsWith(p))) {
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

export default defineConfig({
  site: 'https://opencommunityleadership.dev',
  vite: {
    plugins: [watchRepoContent()],
  },
});
