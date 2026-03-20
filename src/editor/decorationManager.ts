import * as vscode from 'vscode';
import { BlockKeyword } from '../domain/models';

type DecorationStyle = 'border' | 'background' | 'bold';

function createDecorationType(style: DecorationStyle): vscode.TextEditorDecorationType {
  switch (style) {
    case 'background':
      return vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        borderRadius: '2px',
      });
    case 'bold':
      return vscode.window.createTextEditorDecorationType({
        fontWeight: 'bold',
      });
    case 'border':
    default:
      return vscode.window.createTextEditorDecorationType({
        border: '1px solid',
        borderColor: new vscode.ThemeColor('editorBracketHighlight.foreground1'),
        borderRadius: '2px',
      });
  }
}

export class DecorationManager implements vscode.Disposable {
  private decorationType: vscode.TextEditorDecorationType;
  private currentStyle: DecorationStyle;

  constructor(style: DecorationStyle = 'border') {
    this.currentStyle = style;
    this.decorationType = createDecorationType(style);
  }

  applyDecorations(editor: vscode.TextEditor, keywords: BlockKeyword[]): void {
    const ranges = keywords.map(kw => {
      const start = new vscode.Position(kw.start.line, kw.start.character);
      const end = new vscode.Position(kw.end.line, kw.end.character);
      return new vscode.Range(start, end);
    });
    editor.setDecorations(this.decorationType, ranges);
  }

  clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.decorationType, []);
  }

  updateStyle(newStyle: DecorationStyle): void {
    if (newStyle === this.currentStyle) return;
    this.decorationType.dispose();
    this.currentStyle = newStyle;
    this.decorationType = createDecorationType(newStyle);
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
