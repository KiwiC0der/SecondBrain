import type { Graph, NotePreview } from './types';

const RUNTIME_GRAPH = '/data/graph.json';
const SAMPLE_GRAPH = '/data/sample-graph.json';

export interface GraphSource {
  url: string;
  isSample: boolean;
}

export async function loadGraph(): Promise<{ graph: Graph; source: GraphSource }> {
  // Try the freshly-generated graph first; fall back to the committed sample.
  try {
    const res = await fetch(RUNTIME_GRAPH, { cache: 'no-store' });
    if (res.ok) return { graph: (await res.json()) as Graph, source: { url: RUNTIME_GRAPH, isSample: false } };
  } catch {
    // ignore and fall through
  }
  const fallback = await fetch(SAMPLE_GRAPH, { cache: 'no-store' });
  if (!fallback.ok) throw new Error(`Could not load any graph (${RUNTIME_GRAPH} or ${SAMPLE_GRAPH})`);
  return { graph: (await fallback.json()) as Graph, source: { url: SAMPLE_GRAPH, isSample: true } };
}

export type GraphUpdateListener = (graph: Graph) => void;

/** Subscribe to live vault changes. Vite dev only — a no-op in production. */
export function subscribeGraphUpdates(listener: GraphUpdateListener): () => void {
  if (!import.meta.hot) return () => {};
  const handler = (data: Graph) => listener(data);
  import.meta.hot.on('graph:update', handler);
  return () => import.meta.hot?.off('graph:update', handler);
}

export async function loadNotePreview(id: string): Promise<NotePreview | null> {
  // Try freshly-ingested previews first, then committed sample previews.
  for (const base of ['/data/notes/', '/data/sample-notes/']) {
    try {
      const res = await fetch(`${base}${encodeURIComponent(id)}.json`, { cache: 'no-store' });
      if (res.ok) return (await res.json()) as NotePreview;
    } catch {
      // try next
    }
  }
  return null;
}
