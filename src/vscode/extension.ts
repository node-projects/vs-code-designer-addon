import * as vscode from 'vscode';
import { DesignerTextEditor } from './DesignerTextEditor';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(DesignerTextEditor.register(context));
}
