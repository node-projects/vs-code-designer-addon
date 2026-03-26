import * as vscode from 'vscode';
import { DesignerTextEditor } from './DesignerTextEditor.js';

const outlineCommands: Record<string, string> = {
	'designer.outline.lock': 'toggleLock',
	'designer.outline.unlock': 'toggleLock',
	'designer.outline.hideInDesigner': 'toggleHideInDesigner',
	'designer.outline.showInDesigner': 'toggleHideInDesigner',
	'designer.outline.hideAtRuntime': 'toggleHideAtRuntime',
	'designer.outline.showAtRuntime': 'toggleHideAtRuntime',
	'designer.outline.copy': 'copy',
	'designer.outline.cut': 'cut',
	'designer.outline.paste': 'paste',
	'designer.outline.delete': 'delete',
	'designer.outline.rotateLeft': 'rotateLeft',
	'designer.outline.rotateRight': 'rotateRight',
	'designer.outline.toFront': 'toFront',
	'designer.outline.moveForward': 'moveForward',
	'designer.outline.moveBackward': 'moveBackward',
	'designer.outline.toBack': 'toBack',
	'designer.outline.moveTo': 'moveTo',
	'designer.outline.jumpTo': 'jumpTo',
};

export function activate(context: vscode.ExtensionContext) {
	const [registrations, outlineProvider] = DesignerTextEditor.register(context);
	context.subscriptions.push(...registrations);

	vscode.commands.registerCommand('designer.openInDesignerTextEditor', (uri: vscode.Uri) => {
		vscode.commands.executeCommand('vscode.openWith', uri, 'designer.designerTextEditor');
	});

	for (const [cmd, action] of Object.entries(outlineCommands)) {
		context.subscriptions.push(
			vscode.commands.registerCommand(cmd, (item?: { id?: string }) => {
				outlineProvider.sendCommand(action, item?.id);
			})
		);
	}

	// Expand/collapse operate directly on the VS Code outline tree view
	context.subscriptions.push(
		vscode.commands.registerCommand('designer.outline.expandChildren', () => {
			vscode.commands.executeCommand('list.expandRecursively');
		}),
		vscode.commands.registerCommand('designer.outline.collapseChildren', () => {
			vscode.commands.executeCommand('list.collapseAll');
		})
	);
}
