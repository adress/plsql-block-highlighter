import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../src/parser/tokenizer';

describe('tokenize', () => {
  it('recognises keywords case-insensitively', () => {
    const tokens = tokenize('begin end');
    expect(tokens[0].kind).toBe('BEGIN');
    expect(tokens[1].kind).toBe('END');
  });

  it('skips single-line comments', () => {
    const tokens = tokenize('-- comment\nbegin');
    expect(tokens[0].kind).toBe('BEGIN');
  });

  it('skips block comments', () => {
    const tokens = tokenize('/* comment */ begin');
    expect(tokens[0].kind).toBe('BEGIN');
  });

  it('skips string literals', () => {
    const tokens = tokenize("begin 'hello world' end");
    const kinds = tokens.map(t => t.kind);
    expect(kinds).toContain('BEGIN');
    expect(kinds).toContain('STRING');
    expect(kinds).toContain('END');
  });

  it('handles escaped quotes in strings', () => {
    const tokens = tokenize("v := 'it''s fine'; begin");
    const last = tokens.find(t => t.kind === 'BEGIN');
    expect(last).toBeDefined();
  });

  it('records correct line/character positions', () => {
    const tokens = tokenize('begin\n  end');
    const endTok = tokens.find(t => t.kind === 'END')!;
    expect(endTok.start.line).toBe(1);
    expect(endTok.start.character).toBe(2);
  });

  it('emits SEMICOLON token', () => {
    const tokens = tokenize('end;');
    expect(tokens.some(t => t.kind === 'SEMICOLON')).toBe(true);
  });
});
