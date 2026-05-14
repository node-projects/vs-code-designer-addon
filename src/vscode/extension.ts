import * as vscode from 'vscode';
import { DesignerTextEditor } from './DesignerTextEditor.js';
import { LiveShareCollaborationBridge } from './LiveShareCollaborationBridge.js';

export function activate(context: vscode.ExtensionContext) {
	//context.subscriptions.push(
	//	vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, provider));
	const collaborationBridge = new LiveShareCollaborationBridge(context);
	context.subscriptions.push(collaborationBridge);
	context.subscriptions.push(DesignerTextEditor.register(context, collaborationBridge));
	context.subscriptions.push(vscode.commands.registerCommand('designer.showCollaborationLogs', () => {
		collaborationBridge.showOutput();
	}));

	vscode.commands.registerCommand('designer.openInDesignerTextEditor', (uri: vscode.Uri) => {
		vscode.commands.executeCommand('vscode.openWith', uri, 'designer.designerTextEditor');
	});
}
