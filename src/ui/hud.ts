import { loadNotePreview } from '../data/graphLoader';
import type { GraphNode } from '../data/types';

/**
 * Lightweight DOM HUD: a tooltip that follows the cursor over hovered nodes,
 * and a card panel with details when a node is clicked.
 */
export class Hud {
  private tooltip: HTMLDivElement;
  private card: HTMLDivElement;
  private cardOpen = false;
  private onNeighborClick: ((id: string) => void) | null = null;

  constructor() {
    this.tooltip = document.createElement('div');
    applyStyle(this.tooltip, baseTooltipStyle);
    this.tooltip.style.opacity = '0';
    document.body.appendChild(this.tooltip);

    this.card = document.createElement('div');
    applyStyle(this.card, baseCardStyle);
    this.card.style.opacity = '0';
    this.card.style.pointerEvents = 'none';
    document.body.appendChild(this.card);
  }

  setOnNeighborClick(fn: (id: string) => void): void {
    this.onNeighborClick = fn;
  }

  showTooltip(node: GraphNode | null, screenX: number, screenY: number): void {
    if (!node) {
      this.tooltip.style.opacity = '0';
      return;
    }
    this.tooltip.textContent = node.title;
    this.tooltip.style.opacity = '0.95';
    this.tooltip.style.left = `${screenX + 14}px`;
    this.tooltip.style.top = `${screenY + 14}px`;
  }

  async openCard(node: GraphNode): Promise<void> {
    this.cardOpen = true;
    this.card.style.opacity = '1';
    this.card.style.pointerEvents = 'auto';
    this.card.innerHTML = `
      <div class="hud-card-head">
        <span class="hud-cat" data-cat="${node.category}">${node.category}</span>
        <h2>${escapeHtml(node.title)}</h2>
        <button class="hud-close" aria-label="Close">x</button>
      </div>
      <div class="hud-card-body"><div class="hud-loading">loading…</div></div>
    `;
    const closeBtn = this.card.querySelector('.hud-close') as HTMLButtonElement | null;
    closeBtn?.addEventListener('click', () => this.closeCard());

    const preview = await loadNotePreview(node.id);
    const body = this.card.querySelector('.hud-card-body') as HTMLDivElement | null;
    if (!body) return;
    if (!preview) {
      body.innerHTML = `<p class="hud-muted">No preview available for <code>${escapeHtml(node.id)}</code>.</p>
        <p class="hud-muted">degree: ${node.degree} - in: ${node.inDegree} / out: ${node.outDegree}</p>`;
      return;
    }
    const neighborsHtml = preview.neighbors.length
      ? `<ul class="hud-neighbors">${preview.neighbors
          .map((n) => `<li><a data-neighbor="${escapeHtml(n.id)}" href="#">${escapeHtml(n.title)}</a></li>`)
          .join('')}</ul>`
      : `<p class="hud-muted">No connections.</p>`;
    body.innerHTML = `
      <p>${escapeHtml(preview.firstParagraph)}</p>
      <h3>Connections</h3>
      ${neighborsHtml}
    `;
    body.querySelectorAll<HTMLAnchorElement>('a[data-neighbor]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const id = a.getAttribute('data-neighbor');
        if (id && this.onNeighborClick) this.onNeighborClick(id);
      });
    });
  }

  closeCard(): void {
    this.cardOpen = false;
    this.card.style.opacity = '0';
    this.card.style.pointerEvents = 'none';
  }

  get isCardOpen(): boolean {
    return this.cardOpen;
  }

  dispose(): void {
    this.tooltip.remove();
    this.card.remove();
  }
}

const baseTooltipStyle: Record<string, string> = {
  position: 'fixed',
  pointerEvents: 'none',
  padding: '4px 10px',
  background: 'rgba(8, 10, 18, 0.78)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: '#e6e7f3',
  font: '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  letterSpacing: '0.02em',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  zIndex: '20',
  transition: 'opacity 0.12s ease',
  whiteSpace: 'nowrap',
};

const baseCardStyle: Record<string, string> = {
  position: 'fixed',
  top: '50%',
  right: '24px',
  transform: 'translateY(-50%)',
  width: 'min(380px, 32vw)',
  maxHeight: '70vh',
  overflowY: 'auto',
  padding: '18px 20px 22px',
  background: 'rgba(10, 12, 20, 0.78)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  color: '#e8e9f3',
  font: '13.5px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
  boxShadow: '0 12px 60px rgba(0,0,0,0.6)',
  transition: 'opacity 0.18s ease',
  zIndex: '15',
};

// Minimal global stylesheet for the card internals.
const css = `
.hud-card-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.hud-card-head h2 { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.25; flex: 1; color: #f4f4ff; }
.hud-cat {
  display: inline-block;
  padding: 2px 8px; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
  border-radius: 999px; align-self: center;
  background: rgba(255,255,255,0.06); color: #c9c9e0;
}
.hud-cat[data-cat="concepts"]   { background: rgba(184,166,255,0.18); color: #d6c9ff; }
.hud-cat[data-cat="entities"]   { background: rgba(139,224,192,0.18); color: #b6f0d6; }
.hud-cat[data-cat="sources"]    { background: rgba(255,210,139,0.18); color: #ffe2b9; }
.hud-cat[data-cat="syntheses"]  { background: rgba(255,154,177,0.18); color: #ffc6d3; }
.hud-card-body p { margin: 0 0 12px 0; color: #d4d6e6; }
.hud-card-body h3 { margin: 14px 0 6px 0; font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #9aa0c8; }
.hud-neighbors { list-style: none; padding: 0; margin: 0; }
.hud-neighbors li { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.hud-neighbors li:last-child { border-bottom: 0; }
.hud-neighbors a { color: #c5b9ff; text-decoration: none; }
.hud-neighbors a:hover { color: #ebe3ff; }
.hud-muted { color: #9aa0c8; font-size: 12px; }
.hud-loading { color: #9aa0c8; font-style: italic; }
.hud-close {
  background: transparent; border: 0; color: #aaa; font-size: 16px; line-height: 1; cursor: pointer; padding: 4px 6px;
}
.hud-close:hover { color: #fff; }
.hud-card-body code { background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

function applyStyle(el: HTMLElement, style: Record<string, string>): void {
  for (const k of Object.keys(style)) {
    el.style.setProperty(toCssProp(k), style[k] ?? '');
  }
}

function toCssProp(camel: string): string {
  return camel.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
