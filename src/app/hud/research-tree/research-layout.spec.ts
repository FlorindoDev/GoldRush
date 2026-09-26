import { describe, expect, it } from 'vitest';
import { RESEARCH_TREE, flattenResearchTree } from '../../config/research-tree-config';
import { NODE_HEIGHT, NODE_WIDTH, layoutResearch } from './research-layout';

describe('research map layout', () => {
  for (const root of [RESEARCH_TREE, ...(RESEARCH_TREE.children ?? [])]) {
    it(`${root.id}: preserves all nodes and connections without overlapping cards`, () => {
      const layout = layoutResearch(root);
      const expected = flattenResearchTree(root);
      expect(layout.nodes.map(({ node }) => node.id).sort()).toEqual(
        expected.map((node) => node.id).sort(),
      );
      expect(layout.links).toHaveLength(expected.length - 1);
      for (const [index, card] of layout.nodes.entries()) {
        expect(card.x).toBeGreaterThanOrEqual(0);
        expect(card.y).toBeGreaterThanOrEqual(0);
        expect(card.x + NODE_WIDTH).toBeLessThanOrEqual(layout.width);
        expect(card.y + NODE_HEIGHT).toBeLessThanOrEqual(layout.height);
        for (const other of layout.nodes.slice(index + 1)) {
          const overlaps =
            Math.abs(card.x - other.x) < NODE_WIDTH && Math.abs(card.y - other.y) < NODE_HEIGHT;
          expect(overlaps, `${card.node.id} overlaps ${other.node.id}`).toBe(false);
        }
        for (const child of card.node.children ?? []) {
          const target = layout.nodes.find(({ node }) => node.id === child.id)!;
          expect(target.x).toBeGreaterThan(card.x + NODE_WIDTH);
          expect(layout.links.some((link) => link.id === `${card.node.id}-${child.id}`)).toBe(true);
        }
      }
    });
  }
});
