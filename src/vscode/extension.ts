import * as vscode from 'vscode';
import { DesignerTextEditor } from './DesignerTextEditor';
import { DesignerTreeView } from './DesignerTreeView';

export function activate(context: vscode.ExtensionContext) {
	/*context.subscriptions.push(
		vscode.commands.registerCommand('designer.open', () => {
			DesignerPanel.createOrShow(context.extensionUri);
		})
	);

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(DesignerPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				console.log(`Got state: ${state}`);
				// Reset the webview options so we use latest uri for `localResourceRoots`.
				webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
				DesignerPanel.revive(webviewPanel, context.extensionUri);
			}
		});
	}*/

	//vscode.window.registerTreeDataProvider("exampleView", new TreeDataProvider);
	let t = new DesignerTreeView;
	vscode.window.createTreeView("exampleView", {
		treeDataProvider: t,
		dragAndDropController: t,
		showCollapseAll: true,
		canSelectMany: true
	});

	/*vscode.window.onDidChangeActiveTextEditor((e)=> {
console.log("editorchanged", e);
	});*/

	context.subscriptions.push(DesignerTextEditor.register(context));
}
