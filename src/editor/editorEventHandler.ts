import * as vscode from 'vscode';
import { Position } from '../domain/models';
import { getHighlightsForCursor } from '../application/highlightService';
import { DecorationManager } from './decorationManager';

export class EditorEventHandler implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private decorationManager: DecorationManager;

  constructor() {
    this.decorationManager = new DecorationManager(this.getStyle());

    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(e => this.onSelectionChange(e)),
      vscode.window.onDidChangeActiveTextEditor(e => this.onActiveEditorChange(e)),
      vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChange(e)),
      vscode.workspace.onDidChangeConfiguration(e => this.onConfigChange(e)),
    );

    // Run on startup for current editor
    if (vscode.window.activeTextEditor) {
      this.highlight(vscode.window.activeTextEditor);
    }
  }

  private getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('plsqlBlockHighlighter');
  }

  private isEnabled(): boolean {
    return this.getConfig().get<boolean>('enabled', true);
  }

  private getStyle(): 'border' | 'background' | 'bold' {
    return this.getConfig().get<'border' | 'background' | 'bold'>('decorationStyle', 'border');
  }

  private getLanguages(): string[] {
    return this.getConfig().get<string[]>('languages', ['sql', 'plsql']);
  }

  private isActiveLanguage(editor: vscode.TextEditor): boolean {
    return this.getLanguages().includes(editor.document.languageId);
  }

  private onSelectionChange(e: vscode.TextEditorSelectionChangeEvent): void {
    this.highlight(e.textEditor);
  }

  private onActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (editor) this.highlight(editor);
  }

  private onDocumentChange(e: vscode.TextDocumentChangeEvent): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === e.document) {
      this.highlight(editor);
    }
  }

  private onConfigChange(e: vscode.ConfigurationChangeEvent): void {
    if (!e.affectsConfiguration('plsqlBlockHighlighter')) return;
    this.decorationManager.updateStyle(this.getStyle());
    const editor = vscode.window.activeTextEditor;
    if (editor) this.highlight(editor);
  }

  private highlight(editor: vscode.TextEditor): void {
    if (!this.isEnabled() || !this.isActiveLanguage(editor)) {
      this.decorationManager.clearDecorations(editor);
      return;
    }

    const cursor = editor.selection.active;
    const pos: Position = { line: cursor.line, character: cursor.character };
    const text = editor.document.getText();
    const { keywords } = getHighlightsForCursor(text, pos);

    if (keywords.length > 0) {
      this.decorationManager.applyDecorations(editor, keywords);
    } else {
      this.decorationManager.clearDecorations(editor);
    }
  }

  dispose(): void {
    this.decorationManager.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
