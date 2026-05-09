import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

type Category = 'sources' | 'entities' | 'concepts' | 'syntheses' | 'other';

interface RawNote {
  slug: string;
  title: string;
  category: Category;
  path: string;
  body: string;
  outgoing: string[];
}

interface GraphNode {
  id: string;
  title: string;
  category: Category;
  degree: number;
  inDegree: number;
  outDegree: number;
  path: string;
}

interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

interface Graph {
  generatedAt: string;
  nodes: GraphNode[];
  links: GraphLink[];
}

interface NotePreview {
  id: string;
  title: string;
  category: Category;
  firstParagraph: string;
  neighbors: { id: string; title: string }[];
}

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..');

const VAULT_PATH = (process.env.VAULT_PATH ?? '').trim();
const WIKI_SUBDIR = (process.env.WIKI_SUBDIR ?? 'wiki').trim() || 'wiki';

if (!VAULT_PATH) {
  console.log('[ingest] VAULT_PATH not set; skipping (sample-graph.json will be used).');
  process.exit(0);
}

const wikiRoot = path.resolve(VAULT_PATH, WIKI_SUBDIR);
if (!fs.existsSync(wikiRoot)) {
  console.warn(`[ingest] wiki dir does not exist: ${wikiRoot}`);
  process.exit(0);
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) acc.push(full);
  }
  return acc;
}

function categoryFromRel(rel: string): Category {
  const segs = rel.split(/[\\/]/);
  for (const seg of segs) {
    const lower = seg.toLowerCase();
    if (lower === 'sources' || lower === 'entities' || lower === 'concepts' || lower === 'syntheses') {
      return lower;
    }
  }
  return 'other';
}

function slugify(name: string): string {
  return name
    .replace(/\.md$/i, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function extractTitle(body: string, fallback: string): string {
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1?.[1]) return h1[1].trim();
  return fallback;
}

function firstParagraph(body: string): string {
  // Skip leading H1 if present.
  const stripped = body.replace(/^#\s+.+\n+/, '');
  const para = stripped.split(/\n\s*\n/, 1)[0] ?? '';
  return para.replace(/\s+/g, ' ').trim().slice(0, 320);
}

function parseWikilinks(body: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]\n|#]+)(?:[#|][^\]\n]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const target = m[1]?.trim();
    if (target) out.push(slugify(target));
  }
  return out;
}

const files = walk(wikiRoot);
console.log(`[ingest] scanning ${files.length} markdown files under ${wikiRoot}`);

const slugToNote = new Map<string, RawNote>();
for (const file of files) {
  const rel = path.relative(VAULT_PATH, file);
  const slug = slugify(path.basename(file));
  const fileText = fs.readFileSync(file, 'utf8');
  const parsed = matter(fileText);
  const body = parsed.content;
  const title = extractTitle(body, path.basename(file).replace(/\.md$/i, ''));
  const category = categoryFromRel(rel);
  const outgoing = parseWikilinks(body);
  slugToNote.set(slug, { slug, title, category, path: rel.replace(/\\/g, '/'), body, outgoing });
}

const known = new Set(slugToNote.keys());
const inDeg = new Map<string, number>();
const outDeg = new Map<string, number>();
const linkSet = new Set<string>();
const links: GraphLink[] = [];

for (const note of slugToNote.values()) {
  const seen = new Set<string>();
  for (const target of note.outgoing) {
    if (!known.has(target) || target === note.slug) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    const key = `${note.slug}->${target}`;
    if (linkSet.has(key)) continue;
    linkSet.add(key);
    links.push({ source: note.slug, target, weight: 1 });
    outDeg.set(note.slug, (outDeg.get(note.slug) ?? 0) + 1);
    inDeg.set(target, (inDeg.get(target) ?? 0) + 1);
  }
}

const nodes: GraphNode[] = [...slugToNote.values()].map((n) => {
  const i = inDeg.get(n.slug) ?? 0;
  const o = outDeg.get(n.slug) ?? 0;
  return {
    id: n.slug,
    title: n.title,
    category: n.category,
    inDegree: i,
    outDegree: o,
    degree: i + o,
    path: n.path,
  };
});

const graph: Graph = {
  generatedAt: new Date().toISOString(),
  nodes,
  links,
};

const dataDir = path.resolve(projectRoot, 'public', 'data');
const notesDir = path.resolve(dataDir, 'notes');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(notesDir, { recursive: true });
fs.writeFileSync(path.resolve(dataDir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf8');

// Per-note previews
const titleBySlug = new Map(nodes.map((n) => [n.id, n.title]));
const neighborsBySlug = new Map<string, Set<string>>();
for (const link of links) {
  if (!neighborsBySlug.has(link.source)) neighborsBySlug.set(link.source, new Set());
  if (!neighborsBySlug.has(link.target)) neighborsBySlug.set(link.target, new Set());
  neighborsBySlug.get(link.source)!.add(link.target);
  neighborsBySlug.get(link.target)!.add(link.source);
}

for (const note of slugToNote.values()) {
  const preview: NotePreview = {
    id: note.slug,
    title: note.title,
    category: note.category,
    firstParagraph: firstParagraph(note.body),
    neighbors: [...(neighborsBySlug.get(note.slug) ?? new Set())]
      .map((id) => ({ id, title: titleBySlug.get(id) ?? id }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
  fs.writeFileSync(path.resolve(notesDir, `${note.slug}.json`), JSON.stringify(preview, null, 2), 'utf8');
}

console.log(`[ingest] wrote graph.json (${nodes.length} nodes, ${links.length} links) + ${nodes.length} previews`);
