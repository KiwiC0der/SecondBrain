export type Category = 'sources' | 'entities' | 'concepts' | 'syntheses' | 'other';

export interface GraphNode {
  id: string;
  title: string;
  category: Category;
  degree: number;
  inDegree: number;
  outDegree: number;
  path: string;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface Graph {
  generatedAt: string;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface NotePreview {
  id: string;
  title: string;
  category: Category;
  firstParagraph: string;
  neighbors: { id: string; title: string }[];
}
