import * as vscode from 'vscode';
import { DesignerTextEditor } from './DesignerTextEditor.js';

const outlineCommands = [
	'designer.outline.toggleLock',
	'designer.outline.toggleHideInDesigner',
	'designer.outline.toggleHideAtRuntime',
	'designer.outline.copy',
	'designer.outline.cut',
	'designer.outline.paste',
	'designer.outline.delete',
	'designer.outline.rotateLeft',
	'designer.outline.rotateRight',
	'designer.outline.toFront',
	'designer.outline.moveForward',
	'designer.outline.moveBackward',
	'designer.outline.toBack',
	'designer.outline.moveTo',
	'designer.outline.jumpTo',
	'designer.outline.expandChildren',
	'designer.outline.collapseChildren',
];

export function activate(context: vscode.ExtensionContext) {
	const [registrations, outlineProvider] = DesignerTextEditor.register(context);
	context.subscriptions.push(...registrations);

	vscode.commands.registerCommand('designer.openInDesignerTextEditor', (uri: vscode.Uri) => {
		vscode.commands.executeCommand('vscode.openWith', uri, 'designer.designerTextEditor');
	});

	for (const cmd of outlineCommands) {
		context.subscriptions.push(
			vscode.commands.registerCommand(cmd, () => {
				const shortName = cmd.replace('designer.outline.', '');
				outlineProvider.sendCommand(shortName);
			})
		);
	}
}
