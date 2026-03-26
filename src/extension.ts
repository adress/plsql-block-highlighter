import * as vscode from 'vscode';
import { EditorEventHandler } from './editor/editorEventHandler';

let handler: EditorEventHandler | undefined;

export function activate(context: vscode.ExtensionContext): void {
  handler = new EditorEventHandler();
  context.subscriptions.push(handler);

  context.subscriptions.push(
    vscode.commands.registerCommand('plsqlBlockHighlighter.showStructureTree', () => {
      handler?.showStructureTree();
    }),
  );
}

export function deactivate(): void {
  handler?.dispose();
  handler = undefined;
}
