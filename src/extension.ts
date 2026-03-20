import * as vscode from 'vscode';
import { EditorEventHandler } from './editor/editorEventHandler';

let handler: EditorEventHandler | undefined;

export function activate(context: vscode.ExtensionContext): void {
  handler = new EditorEventHandler();
  context.subscriptions.push(handler);
}

export function deactivate(): void {
  handler?.dispose();
  handler = undefined;
}
