# Second Brain Galaxy

A painterly 3D galaxy view of an Obsidian vault. Each note is a star, `[[wikilinks]]` are connections, and you fly through the graph as a custom avatar (Cleo) with stable yaw-based third-person controls.

Built with Vite, TypeScript, Three.js. Procedurally generated nebulas, force-directed graph, post-processing for a hand-painted look. The only binary asset is the avatar.

## Status

Foundation in progress. See [GitHub issues](https://github.com/KiwiC0der/SecondBrain/issues) and milestones M1–M4.

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
| `npm run ingest` | One-shot vault scan; emits `data/graph.json` and `data/notes/*.json` |
| `npm run build` | Ingest + typecheck + production build to `dist/` |
| `npm run preview` | Serve `dist/` for sanity-checking a build |
| `npm run typecheck` | TypeScript project-references check |

## Controls

(Filled in during M3.)

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
  tools/ingest.ts              # vault -> graph.json + per-note JSON
  data/                        # generated graph + sample fallback
  public/cleo.glb              # the avatar (committed)
  .github/workflows/ci.yml     # typecheck + build on push/PR
```

## License

MIT — see [LICENSE](LICENSE).
