import { describe, it, expect } from 'vitest';
import { getHighlightsForCursor } from '../../../src/application/highlightService';

describe('getHighlightsForCursor', () => {
  const src = 'DECLARE\n  v NUMBER;\nBEGIN\n  NULL;\nEXCEPTION\n  WHEN OTHERS THEN NULL;\nEND;';

  it('returns all keywords when cursor is inside the block', () => {
    // Cursor on "NULL;" line (line 3)
    const result = getHighlightsForCursor(src, { line: 3, character: 2 });
    expect(result.keywords).toHaveLength(4);
    const types = result.keywords.map(k => k.type);
    expect(types).toContain('DECLARE');
    expect(types).toContain('BEGIN');
    expect(types).toContain('EXCEPTION');
    expect(types).toContain('END');
  });

  it('returns empty when cursor is outside any block', () => {
    const result = getHighlightsForCursor('BEGIN\n  NULL;\nEND;', { line: 5, character: 0 });
    expect(result.keywords).toHaveLength(0);
  });

  it('returns innermost block for nested blocks', () => {
    const nested = 'BEGIN\n  BEGIN\n    NULL;\n  END;\nEND;';
    // Cursor inside inner block (line 2)
    const result = getHighlightsForCursor(nested, { line: 2, character: 4 });
    expect(result.block).not.toBeNull();
    expect(result.block!.depth).toBeGreaterThan(0);
  });

  it('returns outer block when cursor is in outer block body only', () => {
    const nested = 'BEGIN\n  BEGIN\n    NULL;\n  END;\n  NULL;\nEND;';
    // Cursor on line 4 ("  NULL;") which is outside inner block but inside outer
    const result = getHighlightsForCursor(nested, { line: 4, character: 2 });
    expect(result.block).not.toBeNull();
    expect(result.block!.depth).toBe(0);
  });

  it('returns empty for empty text', () => {
    const result = getHighlightsForCursor('', { line: 0, character: 0 });
    expect(result.keywords).toHaveLength(0);
  });

  it('works when cursor is on the BEGIN keyword itself', () => {
    const result = getHighlightsForCursor('BEGIN\n  NULL;\nEND;', { line: 0, character: 2 });
    expect(result.keywords.length).toBeGreaterThan(0);
  });
});
