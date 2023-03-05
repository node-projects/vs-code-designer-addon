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

		let disableSelectionChange = false;
		let disableUpdateWebview = false;

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
			});
		}

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				if (!disableUpdateWebview) {
					disableUpdateWebview = true;
					updateWebview();
					setTimeout(() => {
						disableUpdateWebview = false;
					}, 50);
				}

			}
		});

		const changeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection(e => {
			if (e.textEditor.document.uri.toString() === document.uri.toString()) {
				if (!disableSelectionChange) {
					disableSelectionChange = true;
					webviewPanel.webview.postMessage({
						type: 'changeSelection',
						position: e.textEditor.document.offsetAt(e.selections[0].start),
					});
					setTimeout(() => {
						disableSelectionChange = false;
					}, 100);
				}
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
			changeTextEditorSelection.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'requestUpdate':
					updateWebview();
					return;
				case 'updateDocument': {
					if (!disableUpdateWebview) {
						disableUpdateWebview = true;
						setTimeout(() => {
							disableUpdateWebview = false;
						}, 50);
						const edit = new vscode.WorkspaceEdit();
						edit.replace(
							document.uri,
							new vscode.Range(0, 0, document.lineCount, 0), e.code);
						return vscode.workspace.applyEdit(edit);
					}
				}
				case 'setSelection':
					{

						if (!disableSelectionChange) {
							disableSelectionChange = true;
							for (const editor of vscode.window.visibleTextEditors) {
								if (editor.document == document) {
									let point1 = editor.document.positionAt(e.position.start);
									let point2 = editor.document.positionAt(e.position.start + e.position.length);
									editor.selection = new vscode.Selection(point1, point2);
								}
							}
							setTimeout(() => {
								disableSelectionChange = false;
							}, 100);
						}
					}
					return;
			}
		});

		updateWebview();
	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'designer.js');

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
		const folder = vscode?.workspace?.workspaceFolders?.[0];
		const workspaceUri = webview.asWebviewUri(<any>folder?.uri);
		const nonce = getNonce();

		return /* html */`
		<!DOCTYPE html>
		<html lang="en" style="height: 100%; width: 100%">
		<head>
			<meta charset="UTF-8">

			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<!--<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">-->

			<script nonce="${nonce}" src="${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/construct-style-sheets-polyfill/dist/adoptedStyleSheets.js'))}"></script>
			<script nonce="${nonce}" type="esms-options">
			  {
				"shimMode": true
			  }
			</script>
			<script nonce="${nonce}" type="text/javascript">
			  window['__$vscodeWorkspaceUri'] = '${workspaceUri}'
			</script>
			<script nonce="${nonce}" src="${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/es-module-shims/dist/es-module-shims.js'))}"></script>
			<script nonce="${nonce}">
			  const importMap = {
				imports: {
				  "@node-projects/base-custom-webcomponent": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@node-projects/base-custom-webcomponent/dist/index.js'))}",
				  "@node-projects/base-custom-webcomponent/": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@node-projects/base-custom-webcomponent/'))}",
				  "@node-projects/web-component-designer": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@node-projects/web-component-designer/dist/index.js'))}",
				  "@node-projects/web-component-designer/": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@node-projects/web-component-designer/'))}",
				  "@node-projects/lean-he-esm": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@node-projects/lean-he-esm/dist/index.js'))}",
				  "@node-projects/lean-he-esm/": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@node-projects/lean-he-esm/'))}",
				  "@adobe/css-tools/dist/esm/type": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@adobe/css-tools/dist/esm/type.js'))}",
				  "@adobe/css-tools/dist/esm/CssParseError": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@adobe/css-tools/dist/esm/CssParseError.js'))}",
				  "@adobe/css-tools/dist/esm/CssPosition": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@adobe/css-tools/dist/esm/CssPosition.js'))}",
				  "@adobe/css-tools/dist/esm/parse": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@adobe/css-tools/dist/esm/parse/index.js'))}",
				  "@adobe/css-tools": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@adobe/css-tools/dist/esm/index.js'))}",
				  "@adobe/css-tools/": "${webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, '/node_modules/@adobe/css-tools/dist/esm/'))}",
				}
			  };
			  //@ts-ignore
			  importShim.addImportMap(importMap);
			</script>
		</head>
		<body style="height: 100%; width: 100%">
			<script nonce="${nonce}" type="module">
				importShim("${scriptUri}");
			</script>

			<node-projects-designer-view style="color: initial; height: 100%; width: calc(100% - 260px); position: absolute; top: 0; left: 0;"></node-projects-designer-view>
			<node-projects-property-grid-with-header id="propertyGrid" style="color: white; height: 100%; width: 260px; position: absolute; top: 0; right: 0;"></node-projects-property-grid-with-header>
		</body>
		</html>`;
	}
}