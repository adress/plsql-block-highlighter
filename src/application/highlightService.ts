/**
 * Pure business-logic layer — no VS Code dependency.
 *
 * Responsibilities:
 *  - Build the block tree from raw text (thin wrapper over parser).
 *  - Given a pre-built tree + cursor, return the highlight result
 *    (thin wrapper over resolver).
 *  - Provide a human-readable tree dump for the debug command.
 */

import { BlockNode, HighlightResult, Position } from '../domain/models';
import { parseBlocks } from '../parser/blockParser';
import { resolveActiveBlock, getBlockTokens } from '../resolver/blockResolver';

// ─────────────────────────────────────────────────────────────────────────────
// Tree construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse PL/SQL `text` and return the root nodes of the block tree.
 * Calling code (the editor layer) is responsible for caching the result.
 */
export function buildTree(text: string): BlockNode[] {
  return parseBlocks(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlight resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a pre-built tree and a cursor position, return:
 *  - the active (innermost) block
 *  - all tokens to decorate for that block
 *  - the nesting level (used to select the decoration colour)
 *  - optionally the parent block + its tokens (for a dimmer "parent" hint)
 *
 * Returns `null` when the cursor is outside every block.
 *
 * This is the **hot path** — it must be fast.  The tree is never rebuilt here;
 * only the resolver walks the already-constructed nodes.
 */
export function getHighlightsForCursor(
  roots: BlockNode[],
  cursor: Position,
): HighlightResult | null {
  const activeBlock = resolveActiveBlock(roots, cursor);
  if (!activeBlock) return null;

  const result: HighlightResult = {
    activeBlock,
    tokens: getBlockTokens(activeBlock),
    nestingLevel: activeBlock.nestingLevel,
  };

  if (activeBlock.parent) {
    result.parentBlock = activeBlock.parent;
    result.parentTokens = getBlockTokens(activeBlock.parent);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug tree formatter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a human-readable, indented representation of the block tree.
 * Shown in the "PL/SQL Structure" Output Channel.
 */
export function formatTree(roots: BlockNode[]): string {
  if (roots.length === 0) return '(no blocks found)';

  const lines: string[] = [];

  function visit(node: BlockNode, depth: number): void {
    const indent = '  '.repeat(depth);
    const startLine = `L${node.startLine + 1}`;
    const endLine = node.endLine !== null ? `L${node.endLine + 1}` : '(incomplete)';
    const declare = node.declareToken ? 'DECLARE → ' : '';
    const suffix = node.endSuffixToken ? ` ${node.endSuffixToken.text.toUpperCase()}` : '';
    lines.push(
      `${indent}[${node.nestingLevel}] ${declare}${node.type}${suffix}  ${startLine}–${endLine}`,
    );
    for (const child of node.children) {
      visit(child, depth + 1);
    }
  }

  for (const root of roots) {
    visit(root, 0);
  }

  return lines.join('\n');
}
