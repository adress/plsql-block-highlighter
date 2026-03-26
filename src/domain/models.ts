// ─────────────────────────────────────────────────────────────────────────────
// Token types  (produced by the scanner)
// ─────────────────────────────────────────────────────────────────────────────

export type TokenKind =
  // Structural block keywords
  | 'DECLARE'
  | 'BEGIN'
  | 'EXCEPTION'
  | 'END'
  // IF construct
  | 'IF'
  | 'THEN'
  | 'ELSIF'
  | 'ELSE'
  // LOOP construct
  | 'LOOP'
  | 'FOR'
  | 'WHILE'
  // CASE construct
  | 'CASE'
  | 'WHEN'
  // Other keywords relevant for CASE-expression detection
  | 'RETURN'
  | 'IN'
  | 'IS'
  | 'AS'
  // Punctuation / operators
  | 'SEMICOLON' // ;
  | 'DOT' // .
  | 'COMMA' // ,
  | 'ASSIGN' // :=
  | 'LPAREN' // (
  | 'RPAREN' // )
  | 'OPERATOR' // all other operators: = < > <= >= != <> || + - * / etc.
  // Literals & identifiers
  | 'WORD'
  | 'NUMBER'
  | 'STRING'
  // End of input
  | 'EOF';

export interface Position {
  /** 0-based line number */
  line: number;
  /** 0-based character offset within the line */
  character: number;
}

export interface Token {
  kind: TokenKind;
  text: string;
  start: Position;
  end: Position;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block-node types  (produced by the parser)
// ─────────────────────────────────────────────────────────────────────────────

export type BlockType = 'BEGIN' | 'IF' | 'LOOP' | 'CASE';

/**
 * A structural node in the PL/SQL parse tree.
 *
 * BEGIN:  startToken=BEGIN  middleTokens=[EXCEPTION?]       endToken=END
 * IF:     startToken=IF     middleTokens=[ELSIF*,ELSE?]     endToken=END  endSuffixToken=IF
 * LOOP:   startToken=LOOP   middleTokens=[]                 endToken=END  endSuffixToken=LOOP
 * CASE:   startToken=CASE   middleTokens=[WHEN+,ELSE?]      endToken=END  endSuffixToken=CASE?
 */
export interface BlockNode {
  type: BlockType;
  /** The primary opening keyword (BEGIN / IF / LOOP / CASE). */
  startToken: Token;
  /** Optional DECLARE keyword that precedes a BEGIN block. */
  declareToken?: Token;
  /** The END keyword that closes this block (null when block is incomplete). */
  endToken: Token | null;
  /** IF / LOOP / CASE suffix after END (present for END IF, END LOOP, END CASE). */
  endSuffixToken?: Token;
  /** Middle structural tokens: EXCEPTION for BEGIN; ELSIF/ELSE for IF; WHEN/ELSE for CASE. */
  middleTokens: Token[];
  /** 0-based line of the first keyword of this block. */
  startLine: number;
  /** 0-based line of the last keyword of this block (null when incomplete). */
  endLine: number | null;
  /** 0 = outermost block; increments with each nesting level. */
  nestingLevel: number;
  /** Parent node in the tree (null for root blocks). */
  parent: BlockNode | null;
  /** Direct children (blocks nested immediately inside this one). */
  children: BlockNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlight result  (produced by resolver + service)
// ─────────────────────────────────────────────────────────────────────────────

export interface HighlightResult {
  activeBlock: BlockNode;
  /** Tokens to highlight with the "active" decoration. */
  tokens: Token[];
  /** nestingLevel of activeBlock (drives color selection). */
  nestingLevel: number;
  /** Immediate parent block, if any (highlighted with "parent" decoration). */
  parentBlock?: BlockNode;
  /** Tokens of the parent block. */
  parentTokens?: Token[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function comparePositions(a: Position, b: Position): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.character - b.character;
}

export function isPositionInRange(pos: Position, start: Position, end: Position): boolean {
  return comparePositions(pos, start) >= 0 && comparePositions(pos, end) <= 0;
}
