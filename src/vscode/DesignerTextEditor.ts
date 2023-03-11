import * as vscode from 'vscode';

export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export class DesignerTextEditor implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new DesignerTextEditor(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(DesignerTextEditor.viewType, provider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		});
		return providerRegistration;
	}

	private static readonly viewType = 'designer.designerTextEditor';

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	public async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
		webviewPanel.webview.options = { enableScripts: true };
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'test.mjs');
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
		const nonce = getNonce();

		return /* html */`
		<!DOCTYPE html>
		<html lang="en" style="height: 100%; width: 100%">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
		</head>
		<body style="height: 100%; width: 100%">
			<script nonce="${nonce}" type="module">
				import('${scriptUri}');
				import('${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@adobe/css-tools/dist/index.mjs'))}');
			</script>
			Hello, this is my HTML. If MJS Works, there should be Text below this.<br><br>
		</body>
		</html>`;
	}
}