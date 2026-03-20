import { Position } from '../domain/models';

export type TokenKind =
  | 'DECLARE'
  | 'BEGIN'
  | 'EXCEPTION'
  | 'END'
  | 'IS'
  | 'AS'
  | 'CASE'
  | 'WHEN'
  | 'THEN'
  | 'LOOP'
  | 'IF'
  | 'ELSIF'
  | 'ELSE'
  | 'FUNCTION'
  | 'PROCEDURE'
  | 'PACKAGE'
  | 'TRIGGER'
  | 'TYPE'
  | 'CURSOR'
  | 'SEMICOLON'
  | 'DOT'
  | 'WORD'
  | 'STRING'
  | 'COMMENT'
  | 'EOF';

export interface Token {
  kind: TokenKind;
  text: string;
  start: Position;
  end: Position;
}

const KEYWORDS = new Set([
  'DECLARE', 'BEGIN', 'EXCEPTION', 'END', 'IS', 'AS',
  'CASE', 'WHEN', 'THEN', 'LOOP', 'IF', 'ELSIF', 'ELSE',
  'FUNCTION', 'PROCEDURE', 'PACKAGE', 'TRIGGER', 'TYPE', 'CURSOR',
]);

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 0;
  let col = 0;

  function advance(n = 1): void {
    for (let i = 0; i < n; i++) {
      if (text[pos] === '\n') { line++; col = 0; }
      else { col++; }
      pos++;
    }
  }

  function peek(offset = 0): string {
    return text[pos + offset] ?? '';
  }

  function makePos(): Position {
    return { line, character: col };
  }

  while (pos < text.length) {
    const ch = text[pos];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance();
      continue;
    }

    // Single-line comment: --
    if (ch === '-' && peek(1) === '-') {
      while (pos < text.length && text[pos] !== '\n') advance();
      continue;
    }

    // Multi-line comment: /* */
    if (ch === '/' && peek(1) === '*') {
      advance(2);
      while (pos < text.length && !(text[pos] === '*' && peek(1) === '/')) advance();
      if (pos < text.length) advance(2);
      continue;
    }

    // String literals: single-quoted
    if (ch === "'") {
      const start = makePos();
      advance();
      while (pos < text.length) {
        if (text[pos] === "'" && peek(1) === "'") { advance(2); continue; }
        if (text[pos] === "'") { advance(); break; }
        advance();
      }
      tokens.push({ kind: 'STRING', text: '', start, end: makePos() });
      continue;
    }

    // Semicolon
    if (ch === ';') {
      const start = makePos();
      advance();
      tokens.push({ kind: 'SEMICOLON', text: ';', start, end: makePos() });
      continue;
    }

    // Dot
    if (ch === '.') {
      const start = makePos();
      advance();
      tokens.push({ kind: 'DOT', text: '.', start, end: makePos() });
      continue;
    }

    // Identifiers / keywords
    if (/[A-Za-z_$#]/.test(ch)) {
      const start = makePos();
      let word = '';
      while (pos < text.length && /[A-Za-z0-9_$#]/.test(text[pos])) {
        word += text[pos];
        advance();
      }
      const upper = word.toUpperCase();
      const kind: TokenKind = (KEYWORDS.has(upper) ? upper : 'WORD') as TokenKind;
      tokens.push({ kind, text: word, start, end: makePos() });
      continue;
    }

    // Skip anything else (operators, numbers, etc.)
    advance();
  }

  tokens.push({ kind: 'EOF', text: '', start: makePos(), end: makePos() });
  return tokens;
}
