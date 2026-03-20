import { BlockKeyword, PlsqlBlock, Position, comparePositions, isPositionInRange } from '../domain/models';
import { parseBlocks } from '../parser/blockParser';

export interface HighlightResult {
  keywords: BlockKeyword[];
  block: PlsqlBlock | null;
}

/**
 * Given document text and a cursor position, returns the keywords
 * (DECLARE / BEGIN / EXCEPTION / END) of the innermost block containing the cursor.
 */
export function getHighlightsForCursor(text: string, cursor: Position): HighlightResult {
  const blocks = parseBlocks(text);
  const containing = findInnermostBlock(blocks, cursor);

  if (!containing) {
    return { keywords: [], block: null };
  }

  const keywords: BlockKeyword[] = [];
  if (containing.declare) keywords.push(containing.declare);
  keywords.push(containing.begin);
  if (containing.exception) keywords.push(containing.exception);
  keywords.push(containing.end);

  return { keywords, block: containing };
}

function findInnermostBlock(blocks: PlsqlBlock[], cursor: Position): PlsqlBlock | null {
  // A cursor is "inside" a block if it's between the block's first keyword start
  // and the END keyword end (inclusive of keyword positions themselves).
  const containing = blocks.filter(b => blockContainsCursor(b, cursor));

  if (containing.length === 0) return null;

  // Pick the deepest (highest depth) one; if tied, pick latest start
  containing.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    return comparePositions(b.begin.start, a.begin.start);
  });

  return containing[0];
}

function blockContainsCursor(block: PlsqlBlock, cursor: Position): boolean {
  const blockStart = block.declare ? block.declare.start : block.begin.start;
  const blockEnd = block.end.end;
  return isPositionInRange(cursor, blockStart, blockEnd);
}
