import { describe, it, expect } from 'vitest';
import { resolveActiveBlock, getBlockTokens } from '../../../src/resolver/blockResolver';
import { parseBlocks } from '../../../src/parser/blockParser';
import { Position, TokenKind } from '../../../src/domain/models';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pos(line: number, character: number): Position {
  return { line, character };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveActiveBlock
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveActiveBlock', () => {
  it('returns null when cursor is outside all blocks', () => {
    const roots = parseBlocks('BEGIN NULL; END;');
    // Line 5 is way beyond the single-line document
    expect(resolveActiveBlock(roots, pos(5, 0))).toBeNull();
  });

  it('returns null for an empty tree', () => {
    expect(resolveActiveBlock([], pos(0, 0))).toBeNull();
  });

  it('returns the block containing the cursor', () => {
    // BEGIN at col 0, END at col 12 (all on line 0)
    const roots = parseBlocks('BEGIN NULL; END;');
    const result = resolveActiveBlock(roots, pos(0, 6));
    expect(result).not.toBeNull();
    expect(result?.type).toBe('BEGIN');
  });

  it('returns innermost block when cursor is inside nested IF', () => {
    const sql = 'BEGIN\n  IF x THEN\n    NULL;\n  END IF;\nEND;';
    const roots = parseBlocks(sql);
    // Cursor on line 2 (inside the IF body)
    const result = resolveActiveBlock(roots, pos(2, 4));
    expect(result?.type).toBe('IF');
  });

  it('returns outer BEGIN when cursor is outside the inner IF', () => {
    const sql = 'BEGIN\n  NULL;\n  IF x THEN NULL; END IF;\nEND;';
    const roots = parseBlocks(sql);
    // Cursor on line 1 (NULL; — before the IF)
    const result = resolveActiveBlock(roots, pos(1, 2));
    expect(result?.type).toBe('BEGIN');
  });

  it('cursor on the opening keyword is inside the block', () => {
    const roots = parseBlocks('BEGIN NULL; END;');
    // Cursor exactly on B of BEGIN (0,0)
    expect(resolveActiveBlock(roots, pos(0, 0))?.type).toBe('BEGIN');
  });

  it('cursor on the closing keyword is still inside the block', () => {
    const roots = parseBlocks('BEGIN NULL; END;');
    // END is at col 12
    expect(resolveActiveBlock(roots, pos(0, 12))?.type).toBe('BEGIN');
  });

  it('cursor just after end of block is outside', () => {
    // "BEGIN NULL; END" → END ends at col 15; cursor at col 16 is outside
    const roots = parseBlocks('BEGIN NULL; END;');
    // col 15 is the ; after END — outside the block
    expect(resolveActiveBlock(roots, pos(0, 16))).toBeNull();
  });

  it('returns innermost for deeply nested structure', () => {
    const sql = `BEGIN\n  IF a THEN\n    LOOP\n      NULL;\n    END LOOP;\n  END IF;\nEND;`;
    const roots = parseBlocks(sql);
    // Line 3: inside LOOP body
    const result = resolveActiveBlock(roots, pos(3, 6));
    expect(result?.type).toBe('LOOP');
    expect(result?.nestingLevel).toBe(2);
  });

  it('treats incomplete block as open-ended', () => {
    const roots = parseBlocks('BEGIN\n  IF x THEN\n    NULL;');
    // Cursor well past the last token → still inside the incomplete BEGIN
    const result = resolveActiveBlock(roots, pos(10, 0));
    expect(result).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBlockTokens
// ─────────────────────────────────────────────────────────────────────────────

describe('getBlockTokens', () => {
  function tokenKinds(sql: string): TokenKind[] {
    const roots = parseBlocks(sql);
    return getBlockTokens(roots[0]).map(t => t.kind);
  }

  it('returns BEGIN and END for a simple block', () => {
    const kinds = tokenKinds('BEGIN NULL; END;');
    expect(kinds).toContain('BEGIN');
    expect(kinds).toContain('END');
  });

  it('includes DECLARE when present', () => {
    const kinds = tokenKinds('DECLARE x NUMBER; BEGIN NULL; END;');
    expect(kinds).toContain('DECLARE');
    expect(kinds).toContain('BEGIN');
    expect(kinds).toContain('END');
  });

  it('includes EXCEPTION for BEGIN…EXCEPTION…END', () => {
    const kinds = tokenKinds('BEGIN NULL; EXCEPTION WHEN OTHERS THEN NULL; END;');
    expect(kinds).toContain('EXCEPTION');
  });

  it('includes both END and IF suffix for END IF', () => {
    const sql = 'BEGIN IF x THEN NULL; END IF; END;';
    const roots = parseBlocks(sql);
    const ifKinds = getBlockTokens(roots[0].children[0]).map(t => t.kind);
    expect(ifKinds).toContain('IF');
    expect(ifKinds).toContain('END');
    // The suffix token is also IF
    expect(ifKinds.filter(k => k === 'IF')).toHaveLength(2);
  });

  it('includes both END and LOOP suffix for END LOOP', () => {
    const sql = 'BEGIN LOOP NULL; END LOOP; END;';
    const roots = parseBlocks(sql);
    const loopKinds = getBlockTokens(roots[0].children[0]).map(t => t.kind);
    expect(loopKinds).toContain('LOOP');
    expect(loopKinds).toContain('END');
    expect(loopKinds.filter(k => k === 'LOOP')).toHaveLength(2); // start + suffix
  });

  it('includes ELSIF and ELSE for an IF block', () => {
    const sql = 'BEGIN IF a THEN NULL; ELSIF b THEN NULL; ELSE NULL; END IF; END;';
    const roots = parseBlocks(sql);
    const ifKinds = getBlockTokens(roots[0].children[0]).map(t => t.kind);
    expect(ifKinds).toContain('ELSIF');
    expect(ifKinds).toContain('ELSE');
  });

  it('includes WHEN tokens for a CASE block', () => {
    const sql = 'BEGIN CASE x WHEN 1 THEN NULL; WHEN 2 THEN NULL; END; END;';
    const roots = parseBlocks(sql);
    const caseKinds = getBlockTokens(roots[0].children[0]).map(t => t.kind);
    expect(caseKinds.filter(k => k === 'WHEN')).toHaveLength(2);
  });

  it('returns only startToken for incomplete block', () => {
    const roots = parseBlocks('BEGIN IF x THEN');
    const ifKinds = getBlockTokens(roots[0].children[0]).map(t => t.kind);
    expect(ifKinds).toContain('IF');
    expect(ifKinds).not.toContain('END');
  });
});
