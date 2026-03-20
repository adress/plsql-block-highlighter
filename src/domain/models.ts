export interface Position {
  line: number;   // 0-based
  character: number; // 0-based
}

export type KeywordType = 'DECLARE' | 'BEGIN' | 'EXCEPTION' | 'END';

export interface BlockKeyword {
  type: KeywordType;
  start: Position;
  end: Position;
}

/**
 * Represents one PL/SQL block (anonymous block, procedure body, etc.)
 * A block always has BEGIN and END; DECLARE and EXCEPTION are optional.
 */
export interface PlsqlBlock {
  declare?: BlockKeyword;
  begin: BlockKeyword;
  exception?: BlockKeyword;
  end: BlockKeyword;
  /** Nesting depth (0 = outermost) */
  depth: number;
}

export function isPositionInRange(pos: Position, start: Position, end: Position): boolean {
  if (pos.line < start.line || pos.line > end.line) return false;
  if (pos.line === start.line && pos.character < start.character) return false;
  if (pos.line === end.line && pos.character > end.character) return false;
  return true;
}

export function comparePositions(a: Position, b: Position): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.character - b.character;
}
