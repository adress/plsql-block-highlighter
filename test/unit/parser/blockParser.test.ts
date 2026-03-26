import { describe, it, expect } from 'vitest';
import { parseBlocks } from '../../../src/parser/blockParser';
import { BlockNode } from '../../../src/domain/models';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function childTypes(node: BlockNode): string[] {
  return node.children.map(n => n.type);
}

// ─────────────────────────────────────────────────────────────────────────────
// BEGIN / END blocks
// ─────────────────────────────────────────────────────────────────────────────

describe('blockParser – BEGIN/END', () => {
  it('parses a simple anonymous block', () => {
    const roots = parseBlocks('BEGIN NULL; END;');
    expect(roots).toHaveLength(1);
    expect(roots[0].type).toBe('BEGIN');
    expect(roots[0].endToken).not.toBeNull();
    expect(roots[0].nestingLevel).toBe(0);
  });

  it('parses DECLARE…BEGIN…END', () => {
    const roots = parseBlocks('DECLARE x NUMBER; BEGIN NULL; END;');
    expect(roots).toHaveLength(1);
    expect(roots[0].declareToken).toBeDefined();
    expect(roots[0].startToken.kind).toBe('BEGIN');
    expect(roots[0].nestingLevel).toBe(0);
  });

  it('parses BEGIN…EXCEPTION…END', () => {
    const roots = parseBlocks('BEGIN NULL; EXCEPTION WHEN OTHERS THEN NULL; END;');
    expect(roots[0].middleTokens).toHaveLength(1);
    expect(roots[0].middleTokens[0].kind).toBe('EXCEPTION');
  });

  it('parses nested BEGIN blocks', () => {
    const sql = 'BEGIN BEGIN NULL; END; END;';
    const roots = parseBlocks(sql);
    expect(roots).toHaveLength(1);
    expect(childTypes(roots[0])).toEqual(['BEGIN']);
    expect(roots[0].nestingLevel).toBe(0);
    expect(roots[0].children[0].nestingLevel).toBe(1);
  });

  it('parses multiple top-level blocks', () => {
    const sql = 'BEGIN NULL; END; BEGIN NULL; END;';
    expect(parseBlocks(sql)).toHaveLength(2);
  });

  it('records startLine / endLine correctly', () => {
    const sql = 'BEGIN\n  NULL;\nEND';
    const roots = parseBlocks(sql);
    expect(roots[0].startLine).toBe(0);
    expect(roots[0].endLine).toBe(2);
  });

  it('records keyword start positions', () => {
    const src = 'BEGIN\n  NULL;\nEND;';
    const roots = parseBlocks(src);
    expect(roots[0].startToken.start.line).toBe(0);
    expect(roots[0].startToken.start.character).toBe(0);
    expect(roots[0].endToken!.start.line).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IF / END IF
// ─────────────────────────────────────────────────────────────────────────────

describe('blockParser – IF/END IF', () => {
  it('parses IF…END IF as child of BEGIN', () => {
    const roots = parseBlocks('BEGIN IF x = 1 THEN NULL; END IF; END;');
    expect(childTypes(roots[0])).toEqual(['IF']);
    const ifBlock = roots[0].children[0];
    expect(ifBlock.endToken?.kind).toBe('END');
    expect(ifBlock.endSuffixToken?.kind).toBe('IF');
  });

  it('does NOT close the parent BEGIN with END IF', () => {
    const sql = 'BEGIN IF x THEN NULL; END IF; END;';
    const roots = parseBlocks(sql);
    expect(roots).toHaveLength(1);
    expect(roots[0].endToken).not.toBeNull();
  });

  it('records ELSIF and ELSE in middleTokens', () => {
    const sql = 'BEGIN IF a THEN NULL; ELSIF b THEN NULL; ELSE NULL; END IF; END;';
    const ifBlock = parseBlocks(sql)[0].children[0];
    expect(ifBlock.middleTokens).toHaveLength(2);
    expect(ifBlock.middleTokens[0].kind).toBe('ELSIF');
    expect(ifBlock.middleTokens[1].kind).toBe('ELSE');
  });

  it('handles nested IF blocks', () => {
    const sql = `
      BEGIN
        IF a THEN
          IF b THEN NULL;
          END IF;
        END IF;
      END;
    `;
    const outer = parseBlocks(sql)[0].children[0];
    const inner = outer.children[0];
    expect(outer.type).toBe('IF');
    expect(inner.type).toBe('IF');
    expect(inner.nestingLevel).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOOP / END LOOP
// ─────────────────────────────────────────────────────────────────────────────

describe('blockParser – LOOP/END LOOP', () => {
  it('parses simple LOOP…END LOOP', () => {
    const roots = parseBlocks('BEGIN LOOP NULL; END LOOP; END;');
    const loop = roots[0].children[0];
    expect(loop.type).toBe('LOOP');
    expect(loop.endToken?.kind).toBe('END');
    expect(loop.endSuffixToken?.kind).toBe('LOOP');
  });

  it('does NOT close the parent BEGIN with END LOOP', () => {
    const sql = 'BEGIN LOOP NULL; END LOOP; END;';
    const roots = parseBlocks(sql);
    expect(roots).toHaveLength(1);
    expect(roots[0].endToken).not.toBeNull();
  });

  it('parses FOR…LOOP…END LOOP (LOOP is the block opener)', () => {
    const sql = 'BEGIN FOR i IN 1..10 LOOP NULL; END LOOP; END;';
    const loop = parseBlocks(sql)[0].children[0];
    expect(loop.type).toBe('LOOP');
    expect(loop.startToken.kind).toBe('LOOP');
  });

  it('parses WHILE…LOOP…END LOOP', () => {
    const sql = 'BEGIN WHILE x > 0 LOOP NULL; END LOOP; END;';
    const loop = parseBlocks(sql)[0].children[0];
    expect(loop.type).toBe('LOOP');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE statement / END
// ─────────────────────────────────────────────────────────────────────────────

describe('blockParser – CASE statement', () => {
  it('parses CASE statement closed by bare END', () => {
    const sql = 'BEGIN CASE x WHEN 1 THEN NULL; ELSE NULL; END; END;';
    const caseBlock = parseBlocks(sql)[0].children[0];
    expect(caseBlock.type).toBe('CASE');
    expect(caseBlock.endToken).not.toBeNull();
    expect(caseBlock.endSuffixToken).toBeUndefined();
  });

  it('also accepts END CASE', () => {
    const sql = 'BEGIN CASE x WHEN 1 THEN NULL; END CASE; END;';
    const caseBlock = parseBlocks(sql)[0].children[0];
    expect(caseBlock.type).toBe('CASE');
    expect(caseBlock.endSuffixToken?.kind).toBe('CASE');
  });

  it('records WHEN and ELSE in middleTokens', () => {
    const sql = 'BEGIN CASE x WHEN 1 THEN NULL; WHEN 2 THEN NULL; ELSE NULL; END; END;';
    const caseBlock = parseBlocks(sql)[0].children[0];
    expect(caseBlock.middleTokens).toHaveLength(3); // WHEN + WHEN + ELSE
  });

  it('ignores CASE expression after :=', () => {
    const sql = 'BEGIN x := CASE y WHEN 1 THEN 0 ELSE 1 END; END;';
    expect(parseBlocks(sql)[0].children).toHaveLength(0);
  });

  it('ignores CASE expression after RETURN', () => {
    const sql = 'BEGIN RETURN CASE x WHEN 1 THEN 0 END; END;';
    expect(parseBlocks(sql)[0].children).toHaveLength(0);
  });

  it('ignores CASE expression inside parentheses', () => {
    const sql = 'BEGIN x := f(CASE y WHEN 1 THEN 2 END); END;';
    expect(parseBlocks(sql)[0].children).toHaveLength(0);
  });

  it('ignores CASE expression after comma', () => {
    const sql = 'BEGIN x := f(a, CASE y WHEN 1 THEN 2 END); END;';
    expect(parseBlocks(sql)[0].children).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mixed nesting
// ─────────────────────────────────────────────────────────────────────────────

describe('blockParser – mixed nesting', () => {
  it('handles LOOP inside IF inside BEGIN', () => {
    const sql = `
      BEGIN
        IF x > 0 THEN
          LOOP NULL; END LOOP;
        END IF;
      END;
    `;
    const ifBlock = parseBlocks(sql)[0].children[0];
    const loop = ifBlock.children[0];
    expect(ifBlock.type).toBe('IF');
    expect(loop.type).toBe('LOOP');
    expect(loop.nestingLevel).toBe(2);
  });

  it('handles CASE inside LOOP inside BEGIN', () => {
    const sql = `
      BEGIN
        LOOP
          CASE x WHEN 1 THEN NULL; END;
        END LOOP;
      END;
    `;
    const loop = parseBlocks(sql)[0].children[0];
    const caseBlock = loop.children[0];
    expect(loop.type).toBe('LOOP');
    expect(caseBlock.type).toBe('CASE');
  });

  it('sets parent references correctly', () => {
    const sql = 'BEGIN IF x THEN NULL; END IF; END;';
    const roots = parseBlocks(sql);
    const beginBlock = roots[0];
    const ifBlock = beginBlock.children[0];
    expect(ifBlock.parent).toBe(beginBlock);
    expect(beginBlock.parent).toBeNull();
  });

  it('handles 3-level deep nesting', () => {
    const sql = `
      BEGIN
        IF a THEN
          LOOP
            BEGIN NULL; END;
          END LOOP;
        END IF;
      END;
    `;
    const roots = parseBlocks(sql);
    const l0 = roots[0];
    const l1 = l0.children[0]; // IF
    const l2 = l1.children[0]; // LOOP
    const l3 = l2.children[0]; // inner BEGIN
    expect(l0.nestingLevel).toBe(0);
    expect(l1.nestingLevel).toBe(1);
    expect(l2.nestingLevel).toBe(2);
    expect(l3.nestingLevel).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Robustness
// ─────────────────────────────────────────────────────────────────────────────

describe('blockParser – robustness', () => {
  it('does not throw on incomplete block (no END)', () => {
    expect(() => parseBlocks('BEGIN IF x THEN')).not.toThrow();
  });

  it('marks incomplete block with endToken = null', () => {
    const roots = parseBlocks('BEGIN NULL;');
    expect(roots[0].endToken).toBeNull();
    expect(roots[0].endLine).toBeNull();
  });

  it('ignores keywords inside string literals', () => {
    const sql = "BEGIN x := 'IF BEGIN END LOOP CASE'; END;";
    const roots = parseBlocks(sql);
    expect(roots).toHaveLength(1);
    expect(roots[0].children).toHaveLength(0);
  });

  it('ignores keywords inside single-line comments', () => {
    const sql = 'BEGIN -- IF LOOP CASE\n NULL; END;';
    expect(parseBlocks(sql)[0].children).toHaveLength(0);
  });

  it('ignores keywords inside block comments', () => {
    const sql = 'BEGIN /* IF LOOP\nCASE */ NULL; END;';
    expect(parseBlocks(sql)[0].children).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(parseBlocks('')).toEqual([]);
  });

  it('handles input with only comments', () => {
    expect(parseBlocks('-- nothing\n/* nothing */')).toEqual([]);
  });
});
