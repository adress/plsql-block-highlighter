import { BlockKeyword, KeywordType, PlsqlBlock } from '../domain/models';
import { Token, TokenKind, tokenize } from './tokenizer';

/**
 * Parses PL/SQL text and extracts all BEGIN/END blocks with optional DECLARE/EXCEPTION.
 *
 * Strategy: walk tokens, maintain a stack of open blocks.
 * CASE ... END CASE and IF ... END IF and LOOP ... END LOOP are not BEGIN/END blocks —
 * we track them separately so their END tokens don't close real blocks.
 */
export function parseBlocks(text: string): PlsqlBlock[] {
  const tokens = tokenize(text);
  const blocks: PlsqlBlock[] = [];

  // Stack entries for real BEGIN blocks
  interface OpenBlock {
    declare?: BlockKeyword;
    begin: BlockKeyword;
    exception?: BlockKeyword;
    depth: number;
  }

  const stack: OpenBlock[] = [];

  // Separate counter for non-BEGIN blocks that also end with END (CASE, IF, LOOP)
  // These consume END tokens without closing a real block.
  const nonBeginEndStack: Array<'CASE' | 'IF' | 'LOOP'> = [];

  let i = 0;

  function tok(offset = 0): Token {
    return tokens[Math.min(i + offset, tokens.length - 1)];
  }

  function kw(t: Token, kind: TokenKind): boolean {
    return t.kind === kind;
  }

  function makeKw(t: Token): BlockKeyword {
    return {
      type: t.kind as KeywordType,
      start: t.start,
      end: t.end,
    };
  }

  // Lookahead: skip past optional label e.g.  END LOOP label_name ;
  function peekEndModifier(): 'CASE' | 'IF' | 'LOOP' | null {
    const next = tok(1);
    if (kw(next, 'CASE')) return 'CASE';
    if (kw(next, 'IF')) return 'IF';
    if (kw(next, 'LOOP')) return 'LOOP';
    return null;
  }

  // Check if this BEGIN is actually part of a CASE WHEN THEN ... BEGIN structure
  // For simplicity, every standalone BEGIN opens a real block.

  while (i < tokens.length) {
    const t = tok();

    if (kw(t, 'CASE')) {
      nonBeginEndStack.push('CASE');
      i++;
      continue;
    }

    if (kw(t, 'IF')) {
      nonBeginEndStack.push('IF');
      i++;
      continue;
    }

    if (kw(t, 'LOOP')) {
      nonBeginEndStack.push('LOOP');
      i++;
      continue;
    }

    if (kw(t, 'DECLARE')) {
      // DECLARE starts an anonymous block — peek ahead to associate with next BEGIN
      // Store as a "pending declare" that the next BEGIN will pick up
      // We handle this by looking for the immediately following BEGIN
      const declareKw = makeKw(t);
      i++;
      // Skip tokens until we hit BEGIN (the matching one),
      // but we also need to handle nested structures.
      // Simple approach: just push onto stack and let BEGIN handle it.
      // We push a sentinel entry.
      stack.push({
        declare: declareKw,
        begin: declareKw, // placeholder, will be replaced when BEGIN is found
        depth: stack.length,
      });
      continue;
    }

    if (kw(t, 'BEGIN')) {
      const beginKw = makeKw(t);
      // Check if top of stack has a pending DECLARE (placeholder)
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.declare && top.begin === top.declare) {
          // Replace placeholder
          top.begin = beginKw;
          i++;
          continue;
        }
      }
      stack.push({ begin: beginKw, depth: stack.length });
      i++;
      continue;
    }

    if (kw(t, 'EXCEPTION')) {
      if (stack.length > 0) {
        stack[stack.length - 1].exception = makeKw(t);
      }
      i++;
      continue;
    }

    if (kw(t, 'END')) {
      const endModifier = peekEndModifier();

      if (endModifier !== null) {
        // This END closes a CASE/IF/LOOP — pop from nonBeginEndStack
        // Find and pop the matching non-begin entry
        for (let j = nonBeginEndStack.length - 1; j >= 0; j--) {
          if (nonBeginEndStack[j] === endModifier) {
            nonBeginEndStack.splice(j, 1);
            break;
          }
        }
        // Skip END + modifier token
        i += 2;
        // Skip optional label (WORD token)
        if (kw(tok(), 'WORD')) i++;
        continue;
      }

      // This END closes a real BEGIN block
      if (stack.length > 0) {
        const open = stack.pop()!;
        // Skip the placeholder-begin case (no real begin was found yet)
        if (open.declare && open.begin === open.declare) {
          // Malformed — just discard
          i++;
          continue;
        }
        const endKw = makeKw(t);
        blocks.push({
          declare: open.declare,
          begin: open.begin,
          exception: open.exception,
          end: endKw,
          depth: open.depth,
        });
      }
      i++;
      continue;
    }

    i++;
  }

  return blocks;
}
