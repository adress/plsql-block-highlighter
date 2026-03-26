import * as vscode from 'vscode';
import { Token } from '../domain/models';

// ─────────────────────────────────────────────────────────────────────────────
// Nesting-level colour palette
// ─────────────────────────────────────────────────────────────────────────────

const NUM_LEVELS = 5;

/**
 * Underline colours for the *active* block (2 px, slightly brighter).
 * Chosen to look good on both dark and light themes.
 */
const ACTIVE_COLORS: readonly string[] = [
  '#5badff', // 0 – blue
  '#5cdf9e', // 1 – green
  '#ffbe5c', // 2 – amber
  '#d97ee0', // 3 – purple
  '#5cdfdf', // 4 – teal
];

/**
 * Underline colours for the *parent* block (1 px, dimmer).
 */
const PARENT_COLORS: readonly string[] = [
  '#3a7abf', // 0 – blue
  '#3aad72', // 1 – green
  '#bf893a', // 2 – amber
  '#9e4eaa', // 3 – purple
  '#3aadad', // 4 – teal
];

// ─────────────────────────────────────────────────────────────────────────────
// DecorationManager
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages VS Code `TextEditorDecorationType` objects for block highlighting.
 *
 * Two sets of decoration types are pre-created (active + parent, one per
 * nesting level).  On each highlight cycle only the relevant types are applied;
 * previously applied types are cleared first.
 */
export class DecorationManager implements vscode.Disposable {
  /** Active-block decoration types indexed by level % NUM_LEVELS. */
  private readonly activeTypes: vscode.TextEditorDecorationType[];
  /** Parent-block decoration types indexed by level % NUM_LEVELS. */
  private readonly parentTypes: vscode.TextEditorDecorationType[];
  /** Decoration types that were applied in the last call to applyDecorations(). */
  private lastApplied: vscode.TextEditorDecorationType[] = [];

  constructor() {
    this.activeTypes = ACTIVE_COLORS.map(color =>
      vscode.window.createTextEditorDecorationType({
        textDecoration: `none; border-bottom: 2px solid ${color}`,
      }),
    );
    this.parentTypes = PARENT_COLORS.map(color =>
      vscode.window.createTextEditorDecorationType({
        textDecoration: `none; border-bottom: 1px solid ${color}`,
      }),
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  applyDecorations(
    editor: vscode.TextEditor,
    activeTokens: Token[],
    activeLevel: number,
    parentTokens?: Token[],
    parentLevel?: number,
  ): void {
    this.clear(editor);

    const activeDeco = this.activeTypes[activeLevel % NUM_LEVELS];
    editor.setDecorations(activeDeco, activeTokens.map(toRange));
    this.lastApplied.push(activeDeco);

    if (parentTokens && parentTokens.length > 0 && parentLevel !== undefined) {
      const parentDeco = this.parentTypes[parentLevel % NUM_LEVELS];
      editor.setDecorations(parentDeco, parentTokens.map(toRange));
      this.lastApplied.push(parentDeco);
    }
  }

  clearDecorations(editor: vscode.TextEditor): void {
    this.clear(editor);
  }

  dispose(): void {
    for (const t of this.activeTypes) t.dispose();
    for (const t of this.parentTypes) t.dispose();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private clear(editor: vscode.TextEditor): void {
    for (const t of this.lastApplied) {
      editor.setDecorations(t, []);
    }
    this.lastApplied = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function toRange(token: Token): vscode.Range {
  return new vscode.Range(
    new vscode.Position(token.start.line, token.start.character),
    new vscode.Position(token.end.line, token.end.character),
  );
}
