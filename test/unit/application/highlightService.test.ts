import { describe, it, expect } from 'vitest';
import { buildTree, getHighlightsForCursor, formatTree } from '../../../src/application/highlightService';
import { Position } from '../../../src/domain/models';

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function pos(line: number, character: number): Position {
  return { line, character };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildTree
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTree', () => {
  it('returns empty array for empty text', () => {
    expect(buildTree('')).toEqual([]);
  });

  it('returns root nodes for a simple block', () => {
    const roots = buildTree('BEGIN NULL; END;');
    expect(roots).toHaveLength(1);
    expect(roots[0].type).toBe('BEGIN');
  });

  it('builds a nested tree', () => {
    const sql = 'BEGIN IF x THEN NULL; END IF; END;';
    const roots = buildTree(sql);
    expect(roots[0].children[0].type).toBe('IF');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getHighlightsForCursor
// ─────────────────────────────────────────────────────────────────────────────

describe('getHighlightsForCursor', () => {
  it('returns null when cursor is outside all blocks', () => {
    const roots = buildTree('BEGIN NULL; END;');
    expect(getHighlightsForCursor(roots, pos(5, 0))).toBeNull();
  });

  it('returns result when cursor is inside a block', () => {
    const roots = buildTree('BEGIN NULL; END;');
    const result = getHighlightsForCursor(roots, pos(0, 6));
    expect(result).not.toBeNull();
    expect(result?.tokens.length).toBeGreaterThan(0);
  });

  it('result contains BEGIN and END tokens', () => {
    const roots = buildTree('BEGIN NULL; END;');
    const result = getHighlightsForCursor(roots, pos(0, 6))!;
    const kinds = result.tokens.map(t => t.kind);
    expect(kinds).toContain('BEGIN');
    expect(kinds).toContain('END');
  });

  it('returns innermost block for nested cursor position', () => {
    const sql = 'BEGIN\n  IF x THEN\n    NULL;\n  END IF;\nEND;';
    const roots = buildTree(sql);
    const result = getHighlightsForCursor(roots, pos(2, 4))!;
    expect(result.activeBlock.type).toBe('IF');
    expect(result.nestingLevel).toBe(1);
  });

  it('provides correct nesting level', () => {
    const sql = 'BEGIN\n  IF a THEN\n    LOOP\n      NULL;\n    END LOOP;\n  END IF;\nEND;';
    const roots = buildTree(sql);
    const result = getHighlightsForCursor(roots, pos(3, 6))!;
    expect(result.activeBlock.type).toBe('LOOP');
    expect(result.nestingLevel).toBe(2);
  });

  it('includes parent block info when available', () => {
    const sql = 'BEGIN\n  IF x THEN NULL; END IF;\nEND;';
    const roots = buildTree(sql);
    const result = getHighlightsForCursor(roots, pos(1, 5))!;
    expect(result.parentBlock).toBeDefined();
    expect(result.parentBlock?.type).toBe('BEGIN');
    expect(result.parentTokens).toBeDefined();
    expect(result.parentTokens!.length).toBeGreaterThan(0);
  });

  it('has no parentBlock for a top-level block', () => {
    const roots = buildTree('BEGIN NULL; END;');
    const result = getHighlightsForCursor(roots, pos(0, 6))!;
    expect(result.parentBlock).toBeUndefined();
    expect(result.parentTokens).toBeUndefined();
  });

  it('returns result for cursor on BEGIN keyword itself', () => {
    const roots = buildTree('BEGIN NULL; END;');
    const result = getHighlightsForCursor(roots, pos(0, 0));
    expect(result).not.toBeNull();
    expect(result?.activeBlock.type).toBe('BEGIN');
  });

  it('returns result for cursor on END keyword', () => {
    const roots = buildTree('BEGIN NULL; END;');
    // END starts at col 12 in "BEGIN NULL; END;"
    const result = getHighlightsForCursor(roots, pos(0, 12));
    expect(result).not.toBeNull();
  });

  it('handles LOOP block correctly', () => {
    const sql = 'BEGIN\n  LOOP\n    NULL;\n  END LOOP;\nEND;';
    const roots = buildTree(sql);
    const result = getHighlightsForCursor(roots, pos(2, 4))!;
    expect(result.activeBlock.type).toBe('LOOP');
    const kinds = result.tokens.map(t => t.kind);
    expect(kinds).toContain('LOOP');
    expect(kinds).toContain('END');
  });

  it('handles CASE block correctly', () => {
    const sql = 'BEGIN\n  CASE x\n    WHEN 1 THEN NULL;\n  END;\nEND;';
    const roots = buildTree(sql);
    const result = getHighlightsForCursor(roots, pos(2, 4))!;
    expect(result.activeBlock.type).toBe('CASE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatTree
// ─────────────────────────────────────────────────────────────────────────────

describe('formatTree', () => {
  it('returns "(no blocks found)" for an empty tree', () => {
    expect(formatTree([])).toBe('(no blocks found)');
  });

  it('contains the block type name', () => {
    const roots = buildTree('BEGIN NULL; END;');
    expect(formatTree(roots)).toContain('BEGIN');
  });

  it('shows nesting level in brackets', () => {
    const roots = buildTree('BEGIN NULL; END;');
    expect(formatTree(roots)).toContain('[0]');
  });

  it('indents child blocks', () => {
    const sql = 'BEGIN IF x THEN NULL; END IF; END;';
    const roots = buildTree(sql);
    const lines = formatTree(roots).split('\n');
    // Root has no leading spaces; child has two spaces of indent
    expect(lines[0]).not.toMatch(/^ /);
    expect(lines[1]).toMatch(/^ {2}/);
  });

  it('marks incomplete blocks', () => {
    const roots = buildTree('BEGIN NULL;');
    expect(formatTree(roots)).toContain('(incomplete)');
  });

  it('shows DECLARE prefix when present', () => {
    const roots = buildTree('DECLARE x NUMBER; BEGIN NULL; END;');
    expect(formatTree(roots)).toContain('DECLARE');
  });
});
