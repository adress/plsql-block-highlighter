import { describe, it, expect } from 'vitest';
import { parseBlocks } from '../../../src/parser/blockParser';

describe('parseBlocks', () => {
  it('parses a simple anonymous block', () => {
    const blocks = parseBlocks('BEGIN\n  NULL;\nEND;');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].begin.type).toBe('BEGIN');
    expect(blocks[0].end.type).toBe('END');
    expect(blocks[0].declare).toBeUndefined();
    expect(blocks[0].exception).toBeUndefined();
  });

  it('parses DECLARE...BEGIN...END block', () => {
    const blocks = parseBlocks('DECLARE\n  v NUMBER;\nBEGIN\n  NULL;\nEND;');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].declare).toBeDefined();
    expect(blocks[0].declare!.type).toBe('DECLARE');
  });

  it('parses BEGIN...EXCEPTION...END block', () => {
    const blocks = parseBlocks('BEGIN\n  NULL;\nEXCEPTION\n  WHEN OTHERS THEN NULL;\nEND;');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].exception).toBeDefined();
    expect(blocks[0].exception!.type).toBe('EXCEPTION');
  });

  it('parses nested blocks', () => {
    const src = `
BEGIN
  BEGIN
    NULL;
  END;
END;`;
    const blocks = parseBlocks(src);
    expect(blocks).toHaveLength(2);
    const depths = blocks.map(b => b.depth).sort();
    expect(depths).toEqual([0, 1]);
  });

  it('does not treat END IF as a block end', () => {
    const src = `
BEGIN
  IF x THEN
    NULL;
  END IF;
END;`;
    const blocks = parseBlocks(src);
    expect(blocks).toHaveLength(1);
  });

  it('does not treat END LOOP as a block end', () => {
    const src = `
BEGIN
  LOOP
    EXIT;
  END LOOP;
END;`;
    const blocks = parseBlocks(src);
    expect(blocks).toHaveLength(1);
  });

  it('does not treat END CASE as a block end', () => {
    const src = `
BEGIN
  CASE x
    WHEN 1 THEN NULL;
  END CASE;
END;`;
    const blocks = parseBlocks(src);
    expect(blocks).toHaveLength(1);
  });

  it('records keyword positions', () => {
    const src = 'BEGIN\n  NULL;\nEND;';
    const blocks = parseBlocks(src);
    expect(blocks[0].begin.start.line).toBe(0);
    expect(blocks[0].begin.start.character).toBe(0);
    expect(blocks[0].end.start.line).toBe(2);
  });
});
