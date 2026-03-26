import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../src/scanner/tokenizer';
import { TokenKind } from '../../../src/domain/models';

function kinds(text: string): TokenKind[] {
  return tokenize(text)
    .filter(t => t.kind !== 'EOF')
    .map(t => t.kind);
}

describe('tokenizer', () => {
  // ── Keywords ──────────────────────────────────────────────────────────────

  it('recognises BEGIN / EXCEPTION / END case-insensitively', () => {
    expect(kinds('begin exception end')).toEqual(['BEGIN', 'EXCEPTION', 'END']);
    expect(kinds('BEGIN EXCEPTION END')).toEqual(['BEGIN', 'EXCEPTION', 'END']);
    expect(kinds('Begin Exception End')).toEqual(['BEGIN', 'EXCEPTION', 'END']);
  });

  it('recognises DECLARE', () => {
    expect(kinds('DECLARE')).toEqual(['DECLARE']);
  });

  it('recognises IF / THEN / ELSIF / ELSE', () => {
    expect(kinds('IF THEN ELSIF ELSE')).toEqual(['IF', 'THEN', 'ELSIF', 'ELSE']);
  });

  it('recognises LOOP / FOR / WHILE', () => {
    expect(kinds('LOOP FOR WHILE')).toEqual(['LOOP', 'FOR', 'WHILE']);
  });

  it('recognises CASE / WHEN', () => {
    expect(kinds('CASE WHEN')).toEqual(['CASE', 'WHEN']);
  });

  it('recognises RETURN / IN / IS / AS', () => {
    expect(kinds('RETURN IN IS AS')).toEqual(['RETURN', 'IN', 'IS', 'AS']);
  });

  // ── Comments ──────────────────────────────────────────────────────────────

  it('skips single-line comments (-- ...)', () => {
    expect(kinds('BEGIN -- IF LOOP CASE\nEND')).toEqual(['BEGIN', 'END']);
  });

  it('skips block comments (/* ... */)', () => {
    expect(kinds('BEGIN /* IF\nLOOP */ END')).toEqual(['BEGIN', 'END']);
  });

  it('skips keywords inside block comments spanning multiple lines', () => {
    const sql = `BEGIN
/* DECLARE
   IF x THEN
   END IF; */
END`;
    expect(kinds(sql)).toEqual(['BEGIN', 'END']);
  });

  // ── String literals ───────────────────────────────────────────────────────

  it('skips keywords inside string literals', () => {
    const sql = "BEGIN x := 'end begin if loop case'; END";
    expect(kinds(sql)).toEqual(['BEGIN', 'WORD', 'ASSIGN', 'STRING', 'SEMICOLON', 'END']);
  });

  it("handles escaped quotes ('') in strings", () => {
    const tokens = tokenize("x := 'it''s here'");
    const str = tokens.find(t => t.kind === 'STRING');
    expect(str).toBeDefined();
    expect(str!.text).toBe("'it''s here'");
  });

  it('handles empty string', () => {
    const tokens = tokenize("x := ''");
    const str = tokens.find(t => t.kind === 'STRING');
    expect(str).toBeDefined();
    expect(str!.text).toBe("''");
  });

  // ── Punctuation / operators ───────────────────────────────────────────────

  it('emits ASSIGN for :=', () => {
    expect(kinds('x := 5')).toContain('ASSIGN');
  });

  it('emits SEMICOLON for ;', () => {
    expect(kinds('NULL;')).toContain('SEMICOLON');
  });

  it('emits LPAREN and RPAREN', () => {
    expect(kinds('(x)')).toEqual(['LPAREN', 'WORD', 'RPAREN']);
  });

  it('emits COMMA', () => {
    expect(kinds('a, b')).toContain('COMMA');
  });

  it('emits OPERATOR for = < > <= >= != <>', () => {
    expect(kinds('= < > <= >= != <>')).toEqual([
      'OPERATOR', 'OPERATOR', 'OPERATOR',
      'OPERATOR', 'OPERATOR', 'OPERATOR', 'OPERATOR',
    ]);
  });

  it('does NOT emit ASSIGN for a bare colon (not :=)', () => {
    // A label like <<lbl>> contains < and > but not :=
    expect(kinds('x : y')).not.toContain('ASSIGN');
  });

  // ── Positions ─────────────────────────────────────────────────────────────

  it('records start position: line 0, char 0 for first token', () => {
    const tokens = tokenize('BEGIN');
    expect(tokens[0].start).toEqual({ line: 0, character: 0 });
  });

  it('records correct line after newline', () => {
    const tokens = tokenize('BEGIN\nEND');
    const end = tokens.find(t => t.kind === 'END')!;
    expect(end.start.line).toBe(1);
    expect(end.start.character).toBe(0);
  });

  it('records correct column offset within a line', () => {
    const tokens = tokenize('x BEGIN');
    const begin = tokens.find(t => t.kind === 'BEGIN')!;
    expect(begin.start.character).toBe(2);
  });

  it('end position is after the last character of the token', () => {
    const tokens = tokenize('BEGIN');
    const begin = tokens[0];
    // "BEGIN" is 5 characters, starting at col 0, ending at col 5
    expect(begin.end.character).toBe(5);
  });

  // ── Numbers & identifiers ─────────────────────────────────────────────────

  it('emits NUMBER for integer literals', () => {
    expect(kinds('42')).toEqual(['NUMBER']);
  });

  it('emits WORD for unknown identifiers', () => {
    expect(kinds('my_var')).toEqual(['WORD']);
  });

  it('emits EOF as the last token', () => {
    const tokens = tokenize('BEGIN');
    expect(tokens[tokens.length - 1].kind).toBe('EOF');
  });
});
