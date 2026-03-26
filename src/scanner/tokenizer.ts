import { Token, TokenKind, Position } from '../domain/models';

// Keywords recognised by the scanner (case-insensitive).
const KEYWORDS: ReadonlyMap<string, TokenKind> = new Map<string, TokenKind>([
  ['DECLARE', 'DECLARE'],
  ['BEGIN', 'BEGIN'],
  ['EXCEPTION', 'EXCEPTION'],
  ['END', 'END'],
  ['IF', 'IF'],
  ['THEN', 'THEN'],
  ['ELSIF', 'ELSIF'],
  ['ELSEIF', 'ELSIF'], // common alias
  ['ELSE', 'ELSE'],
  ['LOOP', 'LOOP'],
  ['FOR', 'FOR'],
  ['WHILE', 'WHILE'],
  ['CASE', 'CASE'],
  ['WHEN', 'WHEN'],
  ['RETURN', 'RETURN'],
  ['IN', 'IN'],
  ['IS', 'IS'],
  ['AS', 'AS'],
]);

/**
 * Converts PL/SQL source text into a flat list of tokens.
 *
 * The scanner:
 *  - skips whitespace (not emitted)
 *  - skips single-line comments  (-- ...)
 *  - skips block comments        (/* ... *‌/)
 *  - emits STRING tokens for single-quoted literals (handles '' escaping)
 *  - emits ASSIGN for :=
 *  - emits LPAREN / RPAREN / SEMICOLON / DOT / COMMA
 *  - emits OPERATOR for = < > <= >= != <> || + - * etc.
 *  - emits KEYWORD tokens for recognised PL/SQL words
 *  - emits WORD for all other identifiers
 *  - emits NUMBER for numeric literals
 *  - emits EOF as the final token
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 0;
  let col = 0;

  // ── helpers ────────────────────────────────────────────────────────────────

  function here(): Position {
    return { line, character: col };
  }

  function ch(offset = 0): string {
    return text[pos + offset] ?? '';
  }

  function advance(): void {
    if (text[pos] === '\n') {
      line++;
      col = 0;
    } else {
      col++;
    }
    pos++;
  }

  function push(kind: TokenKind, tokenText: string, start: Position): void {
    tokens.push({ kind, text: tokenText, start, end: here() });
  }

  // ── main loop ──────────────────────────────────────────────────────────────

  while (pos < text.length) {
    // Whitespace
    if (' \t\r\n'.includes(ch())) {
      advance();
      continue;
    }

    // Single-line comment: -- ...
    if (ch() === '-' && ch(1) === '-') {
      while (pos < text.length && ch() !== '\n') advance();
      continue;
    }

    // Block comment: /* ... */
    if (ch() === '/' && ch(1) === '*') {
      advance();
      advance(); // consume /*
      while (pos < text.length) {
        if (ch() === '*' && ch(1) === '/') {
          advance();
          advance(); // consume */
          break;
        }
        advance();
      }
      continue;
    }

    // String literal: '...' with '' escaping
    if (ch() === "'") {
      const start = here();
      let raw = '';
      raw += ch();
      advance(); // consume opening '
      while (pos < text.length) {
        if (ch() === "'") {
          raw += ch();
          advance();
          if (ch() === "'") {
            // Escaped quote ''
            raw += ch();
            advance();
          } else {
            break; // end of string
          }
        } else {
          raw += ch();
          advance();
        }
      }
      tokens.push({ kind: 'STRING', text: raw, start, end: here() });
      continue;
    }

    // := (assignment operator — must check before single : or =)
    if (ch() === ':' && ch(1) === '=') {
      const start = here();
      advance();
      advance();
      push('ASSIGN', ':=', start);
      continue;
    }

    // Single-character punctuation
    {
      const start = here();
      const c = ch();
      if (c === ';') { advance(); push('SEMICOLON', ';', start); continue; }
      if (c === '.') { advance(); push('DOT', '.', start); continue; }
      if (c === ',') { advance(); push('COMMA', ',', start); continue; }
      if (c === '(') { advance(); push('LPAREN', '(', start); continue; }
      if (c === ')') { advance(); push('RPAREN', ')', start); continue; }
    }

    // Multi-char operators: <= >= != <> ||, then single-char operators
    if ('=<>!|+-*/%~^&'.includes(ch())) {
      const start = here();
      let op = ch();
      advance();
      const next = ch();
      if ((op === '<' || op === '>' || op === '!' || op === '|') && next === '=') {
        op += next; advance();
      } else if (op === '<' && next === '>') {
        op += next; advance();
      } else if (op === '|' && next === '|') {
        op += next; advance();
      }
      push('OPERATOR', op, start);
      continue;
    }

    // Numeric literal
    if (ch() >= '0' && ch() <= '9') {
      const start = here();
      let num = '';
      while (pos < text.length && ((ch() >= '0' && ch() <= '9') || ch() === '.')) {
        num += ch();
        advance();
      }
      push('NUMBER', num, start);
      continue;
    }

    // Identifier or keyword
    if (/[A-Za-z_$#]/.test(ch())) {
      const start = here();
      let word = '';
      while (pos < text.length && /[A-Za-z0-9_$#]/.test(ch())) {
        word += ch();
        advance();
      }
      const upper = word.toUpperCase();
      const kind: TokenKind = KEYWORDS.get(upper) ?? 'WORD';
      tokens.push({ kind, text: word, start, end: here() });
      continue;
    }

    // Skip any other character (e.g. @, \, unrecognised symbols)
    advance();
  }

  tokens.push({ kind: 'EOF', text: '', start: here(), end: here() });
  return tokens;
}
