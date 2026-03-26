import * as vscode from 'vscode';
import { BlockNode, Position } from '../domain/models';
import { buildTree, getHighlightsForCursor, formatTree } from '../application/highlightService';
import { DecorationManager } from './decorationManager';

type DecorationStyle = 'border' | 'background' | 'bold';

interface CacheEntry {
  version: number;
  roots: BlockNode[];
}

export class EditorEventHandler implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private decorationManager: DecorationManager;
  private readonly cache = new Map<string, CacheEntry>();
  private outputChannel: vscode.OutputChannel | undefined;

  constructor() {
    this.decorationManager = new DecorationManager(this.getStyle());

    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(e => this.onSelectionChange(e.textEditor)),
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) this.onSelectionChange(editor);
      }),
      vscode.workspace.onDidChangeTextDocument(e => {
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
        if (!e.affectsConfiguration('plsqlBlockHighlighter')) return;
        this.decorationManager.updateStyle(this.getStyle());
        const active = vscode.window.activeTextEditor;
        if (active) this.onSelectionChange(active);
      }),
    );

    if (vscode.window.activeTextEditor) {
      this.onSelectionChange(vscode.window.activeTextEditor);
    }
  }

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
    this.outputChannel.clear();
    this.outputChannel.appendLine('═══ PL/SQL Structure Tree ═══');
    this.outputChannel.appendLine(`File : ${editor.document.fileName}`);
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(formatTree(roots));
    this.outputChannel.show(true);
  }

  dispose(): void {
    this.decorationManager.dispose();
    this.outputChannel?.dispose();
    for (const d of this.disposables) d.dispose();
  }

  private getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('plsqlBlockHighlighter');
  }

  private getStyle(): DecorationStyle {
    return this.getConfig().get<DecorationStyle>('decorationStyle', 'border');
  }

  private getOrBuildTree(document: vscode.TextDocument): BlockNode[] {
    const key = document.uri.toString();
    const cached = this.cache.get(key);
    if (cached && cached.version === document.version) return cached.roots;
    const roots = buildTree(document.getText());
    this.cache.set(key, { version: document.version, roots });
    return roots;
  }

  private onSelectionChange(editor: vscode.TextEditor): void {
    const config = this.getConfig();

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

    this.decorationManager.applyDecorations(editor, result.tokens);
  }
}
