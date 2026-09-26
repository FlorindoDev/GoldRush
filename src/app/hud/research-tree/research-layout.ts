import { type ResearchNode } from '../../config/research-tree-config';

export const NODE_WIDTH = 184;
export const NODE_HEIGHT = 116;
const COLUMN_STEP = 248;
const ROW_STEP = 138;

export interface PositionedResearch {
  node: ResearchNode;
  x: number;
  y: number;
}

/** Each subtree owns its leaf rows; parents sit between their first and last child. */
export function layoutResearch(root: ResearchNode) {
  const nodes: PositionedResearch[] = [];
  const links: { id: string; path: string; target: ResearchNode }[] = [];
  let row = 0;
  let maxDepth = 0;

  function visit(node: ResearchNode, depth: number): PositionedResearch {
    maxDepth = Math.max(depth, maxDepth);
    const children = (node.children ?? []).map((child) => visit(child, depth + 1));
    const y = children.length
      ? (children[0].y + children[children.length - 1].y) / 2
      : row++ * ROW_STEP + 48;
    const placed = { node, x: depth * COLUMN_STEP + 24, y };
    nodes.push(placed);
    for (const child of children) {
      const startX = placed.x + NODE_WIDTH;
      const startY = y + NODE_HEIGHT / 2;
      const endY = child.y + NODE_HEIGHT / 2;
      const junction = startX + (COLUMN_STEP - NODE_WIDTH) / 2;
      links.push({
        id: `${node.id}-${child.node.id}`,
        target: child.node,
        path: `M ${startX} ${startY} H ${junction} V ${endY} H ${child.x}`,
      });
    }
    return placed;
  }

  visit(root, 0);
  return {
    nodes: nodes.reverse(),
    links,
    width: maxDepth * COLUMN_STEP + NODE_WIDTH + 48,
    height: Math.max(row, 1) * ROW_STEP + 74,
    columns: Array.from({ length: maxDepth + 1 }, (_, index) => ({
      x: index * COLUMN_STEP + 24,
      label: index === 0 ? 'ORIGINE' : `LIVELLO ${String(index).padStart(2, '0')}`,
    })),
  };
}
