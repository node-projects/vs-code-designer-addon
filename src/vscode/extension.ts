import * as vscode from 'vscode';
import { DesignerTextEditor } from './DesignerTextEditor';
import { DesignerTreeView } from './DesignerTreeView';

export function activate(context: vscode.ExtensionContext) {
	let t = new DesignerTreeView;
	vscode.window.createTreeView("designerTreeView", {
		treeDataProvider: t,
		dragAndDropController: t,
		showCollapseAll: true,
		canSelectMany: true
	});

	context.subscriptions.push(DesignerTextEditor.register(context));
}
