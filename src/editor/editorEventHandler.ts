import * as vscode from 'vscode';
import { BlockNode, Position } from '../domain/models';
import { buildTree, getHighlightsForCursor, formatTree } from '../application/highlightService';
import { DecorationManager } from './decorationManager';

// ─────────────────────────────────────────────────────────────────────────────
// Document cache
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  /** VS Code document version at the time of parsing. */
  version: number;
  /** The parse tree built from that version of the document. */
  roots: BlockNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorEventHandler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listens to VS Code events, orchestrates parsing + highlighting.
 *
 * Performance strategy
 * ────────────────────
 * • The block tree is rebuilt **only** when the document content changes.
 *   The result is cached keyed by document URI + version.
 * • On cursor movement (the hot path) only the resolver runs against the
 *   already-cached tree — O(tree depth), not O(document length).
 */
export class EditorEventHandler implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly decorationManager = new DecorationManager();
  private readonly cache = new Map<string, CacheEntry>();
  private outputChannel: vscode.OutputChannel | undefined;

  constructor() {
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(e => this.onSelectionChange(e.textEditor)),
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) this.onSelectionChange(editor);
      }),
      vscode.workspace.onDidChangeTextDocument(e => {
        // Invalidate cache so the next highlight cycle re-parses.
        this.cache.delete(e.document.uri.toString());
        const active = vscode.window.activeTextEditor;
        if (active && active.document === e.document) {
          this.onSelectionChange(active);
        }
      }),
      vscode.workspace.onDidCloseTextDocument(doc => {
        this.cache.delete(doc.uri.toString());
      }),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('plsqlBlockHighlighter')) {
          const active = vscode.window.activeTextEditor;
          if (active) this.onSelectionChange(active);
        }
      }),
    );

    // Highlight immediately for the editor that is open on activation.
    if (vscode.window.activeTextEditor) {
      this.onSelectionChange(vscode.window.activeTextEditor);
    }
  }

  // ── Debug command ──────────────────────────────────────────────────────────

  /**
   * Show the block tree for the active document in an Output Channel.
   * Triggered by the `plsqlBlockHighlighter.showStructureTree` command.
   */
  showStructureTree(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('PL/SQL Block Highlighter: no active editor.');
      return;
    }

    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('PL/SQL Structure');
    }

    const roots = this.getOrBuildTree(editor.document);
    const tree = formatTree(roots);

    this.outputChannel.clear();
    this.outputChannel.appendLine('═══ PL/SQL Structure Tree ═══');
    this.outputChannel.appendLine(`File : ${editor.document.fileName}`);
    this.outputChannel.appendLine(`Lines: ${editor.document.lineCount}`);
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(tree);
    this.outputChannel.show(/* preserveFocus */ true);
  }

  // ── Disposable ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.decorationManager.dispose();
    this.outputChannel?.dispose();
    for (const d of this.disposables) d.dispose();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private getOrBuildTree(document: vscode.TextDocument): BlockNode[] {
    const key = document.uri.toString();
    const cached = this.cache.get(key);
    if (cached && cached.version === document.version) return cached.roots;

    const roots = buildTree(document.getText());
    this.cache.set(key, { version: document.version, roots });
    return roots;
  }

  private onSelectionChange(editor: vscode.TextEditor): void {
    const config = vscode.workspace.getConfiguration('plsqlBlockHighlighter');

    if (!config.get<boolean>('enabled', true)) {
      this.decorationManager.clearDecorations(editor);
      return;
    }

    const languages = config.get<string[]>('languages', ['sql', 'plsql']);
    if (!languages.includes(editor.document.languageId)) {
      this.decorationManager.clearDecorations(editor);
      return;
    }

    const cursor: Position = {
      line: editor.selection.active.line,
      character: editor.selection.active.character,
    };

    const roots = this.getOrBuildTree(editor.document);
    const result = getHighlightsForCursor(roots, cursor);

    if (!result) {
      this.decorationManager.clearDecorations(editor);
      return;
    }

    this.decorationManager.applyDecorations(
      editor,
      result.tokens,
      result.nestingLevel,
      result.parentTokens,
      result.parentBlock?.nestingLevel,
    );
  }
}
