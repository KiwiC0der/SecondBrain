import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import chokidar from 'chokidar';

function resolveCleoPath(envCleo: string | undefined, projectRoot: string): string {
  const raw = (envCleo && envCleo.trim().length > 0) ? envCleo : 'public/cleo.glb';
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

function runIngest(projectRoot: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['tsx', 'tools/ingest.ts'],
      { cwd: projectRoot, stdio: 'inherit', env: { ...process.env } },
    );
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

function readGraph(projectRoot: string): unknown | null {
  const p = path.join(projectRoot, 'public', 'data', 'graph.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

interface PluginOptions {
  vaultPath: string | undefined;
  wikiSubdir: string;
  cleoAbsPath: string;
  projectRoot: string;
}

function galaxyPlugin(opts: PluginOptions): Plugin {
  let server: ViteDevServer | undefined;
  return {
    name: 'galaxy',

    async buildStart() {
      if (opts.vaultPath) {
        await runIngest(opts.projectRoot);
      }
    },

    configureServer(s) {
      server = s;

      // Serve Cleo from a path outside the project tree if requested.
      const inProjectPublic = opts.cleoAbsPath.startsWith(
        path.resolve(opts.projectRoot, 'public') + path.sep,
      );
      if (!inProjectPublic) {
        s.middlewares.use('/cleo.glb', (_req, res) => {
          if (!fs.existsSync(opts.cleoAbsPath)) {
            res.statusCode = 404;
            res.end('cleo.glb not found at ' + opts.cleoAbsPath);
            return;
          }
          res.setHeader('Content-Type', 'model/gltf-binary');
          fs.createReadStream(opts.cleoAbsPath).pipe(res);
        });
      }

      if (!opts.vaultPath) {
        s.config.logger.info(
          '[galaxy] VAULT_PATH not set, using committed sample-graph.json (HMR disabled)',
        );
        return;
      }

      const watchDir = path.join(opts.vaultPath, opts.wikiSubdir);
      if (!fs.existsSync(watchDir)) {
        s.config.logger.warn(`[galaxy] vault dir does not exist: ${watchDir}`);
        return;
      }

      const watcher = chokidar.watch(`${watchDir.replace(/\\/g, '/')}/**/*.md`, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
      });

      let timer: NodeJS.Timeout | undefined;
      const reingest = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
          await runIngest(opts.projectRoot);
          const graph = readGraph(opts.projectRoot);
          if (graph) {
            server?.ws.send({ type: 'custom', event: 'graph:update', data: graph });
            s.config.logger.info('[galaxy] graph:update pushed');
          }
        }, 250);
      };

      watcher.on('add', reingest).on('change', reingest).on('unlink', reingest);
      s.httpServer?.once('close', () => watcher.close());
    },

    closeBundle() {
      // For prod build: copy Cleo into dist/ if it's outside the project tree.
      const distPath = path.resolve(opts.projectRoot, 'dist', 'cleo.glb');
      const inProjectPublic = opts.cleoAbsPath.startsWith(
        path.resolve(opts.projectRoot, 'public') + path.sep,
      );
      if (!inProjectPublic && fs.existsSync(opts.cleoAbsPath)) {
        fs.mkdirSync(path.dirname(distPath), { recursive: true });
        fs.copyFileSync(opts.cleoAbsPath, distPath);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const projectRoot = path.resolve(__dirname);
  const env = loadEnv(mode, projectRoot, '');
  const vaultPath = (env.VAULT_PATH && env.VAULT_PATH.trim().length > 0) ? env.VAULT_PATH : undefined;
  const wikiSubdir = env.WIKI_SUBDIR && env.WIKI_SUBDIR.length > 0 ? env.WIKI_SUBDIR : 'wiki';
  const cleoAbsPath = resolveCleoPath(env.CLEO_GLB_PATH, projectRoot);

  return {
    root: projectRoot,
    plugins: [galaxyPlugin({ vaultPath, wikiSubdir, cleoAbsPath, projectRoot })],
    server: {
      fs: {
        allow: [
          projectRoot,
          ...(vaultPath ? [vaultPath] : []),
          path.dirname(cleoAbsPath),
        ],
      },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
  };
});
