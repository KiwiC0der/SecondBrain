# Second Brain Galaxy

A painterly 3D galaxy view of an Obsidian vault. Each note is a star, `[[wikilinks]]` are connections, and you fly through the graph as a custom avatar (Cleo) with stable yaw-based third-person controls.

Built with Vite, TypeScript, Three.js. Procedurally generated nebulas, force-directed graph, post-processing for a hand-painted look. The only binary asset is the avatar.

## Status

M1–M4 complete. See [GitHub issues](https://github.com/KiwiC0der/SecondBrain/issues) and milestones for ongoing work.

## Quick start

```bash
git clone https://github.com/KiwiC0der/SecondBrain.git galaxy
cd galaxy
npm install
npm run dev
```

This boots the app on `http://localhost:5173` against the committed `data/sample-graph.json`. To point at your own Obsidian vault:

```bash
cp .env.example .env.local
# then edit .env.local and set:
#   VAULT_PATH=C:/path/to/your/Obsidian Vault
#   WIKI_SUBDIR=wiki         # or whatever you want scanned
npm run dev                  # ingest runs once, watcher hot-reloads on note changes
```

## Scripts

| script | what it does |
| --- | --- |
| `npm run dev` | Vite dev server + vault watcher with HMR-pushed graph updates |
| `npm run ingest` | One-shot vault scan; emits `public/data/graph.json` and `public/data/notes/*.json` |
| `npm run build` | Ingest + typecheck + production build to `dist/` |
| `npm run preview` | Serve `dist/` for sanity-checking a build |
| `npm run typecheck` | TypeScript project-references check |

## Controls

Click the canvas to capture the mouse, then:

| key / mouse | action |
| --- | --- |
| `W` `A` `S` `D` | Move forward / strafe / back |
| `Space` / `Ctrl` | Ascend / descend |
| `Shift` | Boost (sprint) |
| Mouse | Yaw + pitch (avatar locked center-frame, banks on turns) |
| `Esc` | Release pointer lock / close open node card |
| Hover a node | Tooltip with title + degree |
| Click a node | Open the HUD card (title, first paragraph, neighbors) |
| `H` | Hide / show the dev toolbar |

The dev toolbar (top-right) exposes every tunable parameter — galaxy, env, nodes, links, forces, avatar, movement, camera, post chain, debug. Use the **Presets** folder to save/load named looks (`default`, `cinematic`, `sketch`, `noir` ship built-in). All edits persist to `localStorage` and can be exported / imported as JSON.

## Deploy

Any static host works. The build output is plain `dist/` with no server.

```bash
npm run build           # ingests vault if VAULT_PATH set, else uses sample data
npm run preview         # local sanity check of dist/
```

GitHub Pages, Netlify, Vercel, Cloudflare Pages — all fine; just point the publish dir at `dist`. CI typechecks and builds on every push (`.github/workflows/ci.yml`) and uploads `dist` as an artifact.

## Repo layout

```
galaxy/
  src/                         # Three.js app source
    world/                     # galaxy backdrop, graph, avatar, env, controls
    shaders/                   # GLSL (procedural nebulas, brush strokes, painterly Cleo)
    shaders/post/              # post-processing passes
    post/                      # EffectComposer pipeline
    ui/                        # Tweakpane toolbar, presets, HUD
    data/                      # graph loader, types
    state/params.ts            # single source of truth for tunables
  tools/ingest.ts              # vault -> graph.json + per-note JSON
  public/data/                 # generated graph + sample fallback (served verbatim)
  public/cleo.glb              # the avatar (committed)
  .github/workflows/ci.yml     # typecheck + build on push/PR
```

## License

MIT — see [LICENSE](LICENSE).
