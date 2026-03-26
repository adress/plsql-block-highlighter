import { Token, TokenKind, BlockType, BlockNode } from '../domain/models';
import { tokenize } from '../scanner/tokenizer';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Return the next token that is neither a comment nor EOF, together with its index. */
function nextSignificant(
  tokens: Token[],
  from: number,
): { token: Token; index: number } | null {
  for (let i = from; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'EOF') return { token: t, index: i };
  }
  return null;
}

/**
 * Decide whether the CASE token at `caseIndex` opens a *statement* CASE block.
 *
 * A CASE is treated as an **expression** (and therefore ignored by the parser)
 * when the previous significant token is one of:
 *   :=  =  <  >  <=  >=  !=  <>  (  ,  RETURN  IN  ||  +  -  *  /
 *
 * Everything else → statement CASE.
 */
function isStatementCase(tokens: Token[], caseIndex: number): boolean {
  for (let i = caseIndex - 1; i >= 0; i--) {
    const t = tokens[i];
    if (
      t.kind === 'ASSIGN' || // :=
      t.kind === 'OPERATOR' || // = < > <= >= != <> || + - * / …
      t.kind === 'LPAREN' || // (
      t.kind === 'COMMA' || // ,
      t.kind === 'RETURN' || // RETURN <expr>
      t.kind === 'IN' // x IN (CASE …)
    ) {
      return false;
    }
    // Any other token → this is a statement-level CASE
    return true;
  }
  // Nothing before CASE → statement level (e.g. very first token)
  return true;
}

function createNode(type: BlockType, startToken: Token, stack: BlockNode[]): BlockNode {
  return {
    type,
    startToken,
    endToken: null,
    middleTokens: [],
    startLine: startToken.start.line,
    endLine: null,
    nestingLevel: stack.length,
    parent: stack.length > 0 ? stack[stack.length - 1] : null,
    children: [],
  };
}

function attachNode(node: BlockNode, roots: BlockNode[], stack: BlockNode[]): void {
  if (node.parent) {
    node.parent.children.push(node);
  } else {
    roots.push(node);
  }
  stack.push(node);
}

/**
 * Close the topmost block whose type is in `types` (searching down the stack).
 * Everything above that block remains on the stack with `endToken = null`
 * (they are considered incomplete / badly nested).
 *
 * Pass `types = null` to close whatever is on top (used for bare END).
 */
function resolveClosingToken(
  stack: BlockNode[],
  types: BlockType | BlockType[] | null,
  endToken: Token,
  endSuffixToken?: Token,
): void {
  const allowed = types === null ? null : Array.isArray(types) ? types : [types];

  for (let i = stack.length - 1; i >= 0; i--) {
    if (allowed === null || allowed.includes(stack[i].type)) {
      const node = stack[i];
      node.endToken = endToken;
      if (endSuffixToken) node.endSuffixToken = endSuffixToken;
      node.endLine = (endSuffixToken ?? endToken).end.line;
      // Remove this node and everything above it from the open stack.
      stack.splice(i);
      return;
    }
  }
  // No matching open block found — ignore the stray END.
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse PL/SQL source text and return the root nodes of the block tree.
 *
 * Each `BlockNode` has a `parent` reference and a `children` array, forming
 * a proper tree.  Incomplete (unclosed) blocks have `endToken = null`.
 */
export function parseBlocks(text: string): BlockNode[] {
  return parseTokens(tokenize(text));
}

/**
 * Build the block tree from a pre-tokenised stream.
 * Exposed for unit testing.
 */
export function parseTokens(tokens: Token[]): BlockNode[] {
  const roots: BlockNode[] = [];
  /** Open (not yet closed) blocks, outermost first. */
  const stack: BlockNode[] = [];
  /** DECLARE token waiting to be consumed by the next BEGIN. */
  let pendingDeclare: Token | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    switch (token.kind as TokenKind) {
      // ── DECLARE ─────────────────────────────────────────────────────────
      case 'DECLARE': {
        // Reset any previous orphaned DECLARE (malformed input).
        pendingDeclare = token;
        break;
      }

      // ── BEGIN ────────────────────────────────────────────────────────────
      case 'BEGIN': {
        const node = createNode('BEGIN', token, stack);
        if (pendingDeclare) {
          node.declareToken = pendingDeclare;
          pendingDeclare = null;
        }
        attachNode(node, roots, stack);
        break;
      }

      // ── IF ───────────────────────────────────────────────────────────────
      case 'IF': {
        const node = createNode('IF', token, stack);
        attachNode(node, roots, stack);
        break;
      }

      // ── LOOP ─────────────────────────────────────────────────────────────
      // FOR … LOOP and WHILE … LOOP also hit this branch because LOOP is the
      // structural keyword that opens the block body.
      case 'LOOP': {
        const node = createNode('LOOP', token, stack);
        attachNode(node, roots, stack);
        break;
      }

      // ── CASE ─────────────────────────────────────────────────────────────
      case 'CASE': {
        if (!isStatementCase(tokens, i)) break; // expression CASE → ignore
        const node = createNode('CASE', token, stack);
        attachNode(node, roots, stack);
        break;
      }

      // ── EXCEPTION ────────────────────────────────────────────────────────
      case 'EXCEPTION': {
        const top = stack[stack.length - 1];
        if (top?.type === 'BEGIN') top.middleTokens.push(token);
        break;
      }

      // ── ELSIF / ELSE ─────────────────────────────────────────────────────
      case 'ELSIF':
      case 'ELSE': {
        const top = stack[stack.length - 1];
        if (top?.type === 'IF' || top?.type === 'CASE') top.middleTokens.push(token);
        break;
      }

      // ── WHEN ─────────────────────────────────────────────────────────────
      // Only record WHEN when directly inside a CASE block (not inside a nested
      // BEGIN that was opened in a WHEN branch).
      case 'WHEN': {
        const top = stack[stack.length - 1];
        if (top?.type === 'CASE') top.middleTokens.push(token);
        break;
      }

      // ── END ──────────────────────────────────────────────────────────────
      case 'END': {
        const next = nextSignificant(tokens, i + 1);

        if (next?.token.kind === 'IF') {
          i = next.index;
          resolveClosingToken(stack, 'IF', token, next.token);
        } else if (next?.token.kind === 'LOOP') {
          i = next.index;
          resolveClosingToken(stack, 'LOOP', token, next.token);
        } else if (next?.token.kind === 'CASE') {
          // END CASE is an optional alternative closer for CASE blocks.
          i = next.index;
          resolveClosingToken(stack, 'CASE', token, next.token);
        } else {
          // Bare END → closes the nearest BEGIN or CASE on the stack.
          resolveClosingToken(stack, ['BEGIN', 'CASE'], token);
        }
        break;
      }

      default:
        // Any other token (THEN, FOR, WHILE, WORD, SEMICOLON, …) — no action.
        break;
    }
  }

  return roots;
}
