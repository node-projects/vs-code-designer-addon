import * as vscode from 'vscode';
import { DesignerTextEditor } from './DesignerTextEditor.js';
import { DesignerTreeView } from './DesignerTreeView.js';

export function activate(context: vscode.ExtensionContext) {
	let t = new DesignerTreeView;
	vscode.window.createTreeView("designerTreeView", {
		treeDataProvider: t,
		dragAndDropController: t,
		showCollapseAll: true,
		canSelectMany: true
	});

	//context.subscriptions.push(
	//	vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, provider));


	context.subscriptions.push(DesignerTextEditor.register(context));
}
