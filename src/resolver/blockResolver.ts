import { BlockNode, Position, Token, comparePositions } from '../domain/models';

// ─────────────────────────────────────────────────────────────────────────────
// Cursor → active block
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk the block tree and return the *innermost* (deepest) node that contains
 * `cursor`.  Returns `null` when the cursor is not inside any block.
 */
export function resolveActiveBlock(roots: BlockNode[], cursor: Position): BlockNode | null {
  let deepest: BlockNode | null = null;

  function visit(node: BlockNode): void {
    if (!nodeContainsCursor(node, cursor)) return;

    if (deepest === null || node.nestingLevel > deepest.nestingLevel) {
      deepest = node;
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  for (const root of roots) {
    visit(root);
  }

  return deepest;
}

/**
 * A block "contains" the cursor when the cursor is on or after the block's
 * first keyword (DECLARE if present, otherwise the opening keyword) and on
 * or before the block's last keyword (endSuffixToken ?? endToken).
 *
 * For *incomplete* blocks (no `endToken`), any cursor position after the start
 * is considered inside the block — useful for in-progress editing.
 */
function nodeContainsCursor(node: BlockNode, cursor: Position): boolean {
  const startPos = node.declareToken ? node.declareToken.start : node.startToken.start;

  if (comparePositions(cursor, startPos) < 0) return false;

  if (node.endToken === null) {
    // Incomplete block: cursor is inside as long as it is after the start.
    return true;
  }

  const endPos = node.endSuffixToken ? node.endSuffixToken.end : node.endToken.end;
  return comparePositions(cursor, endPos) <= 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block → tokens to decorate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all structural tokens for a block.
 *
 * Order: declareToken? → startToken → middleTokens → endToken → endSuffixToken?
 *
 * All of these receive the same decoration so the user sees the complete
 * "frame" of the block.
 */
export function getBlockTokens(node: BlockNode): Token[] {
  const result: Token[] = [];

  if (node.declareToken) result.push(node.declareToken);
  result.push(node.startToken);
  result.push(...node.middleTokens);

  if (node.endToken) {
    result.push(node.endToken);
    if (node.endSuffixToken) result.push(node.endSuffixToken);
  }

  return result;
}
