import * as vscode from 'vscode';
import { DesignerTextEditor } from './DesignerTextEditor.js';

export function activate(context: vscode.ExtensionContext) {
	//context.subscriptions.push(
	//	vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, provider));
	context.subscriptions.push(DesignerTextEditor.register(context));

	vscode.commands.registerCommand('designer.openInDesignerTextEditor', (uri: vscode.Uri) => {
		vscode.commands.executeCommand('vscode.openWith', uri, 'designer.designerTextEditor');
	});
}
