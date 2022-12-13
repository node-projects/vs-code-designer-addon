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
		const providerRegistration = vscode.window.registerCustomEditorProvider(DesignerTextEditor.viewType, provider, { webviewOptions: {
			retainContextWhenHidden: true
		}});
		return providerRegistration;
	}

	private static readonly viewType = 'designer.designerTextEditor';

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		const changeTextEditorSlection = vscode.window.onDidChangeTextEditorSelection(e => {
			webviewPanel.webview.postMessage({
				type: 'changeSelection',
				position: e.textEditor.document.offsetAt(e.selections[0].start),
			});
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
			changeTextEditorSlection.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'requestUpdate':
					updateWebview();
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
				}
			  };
			  //@ts-ignore
			  importShim.addImportMap(importMap);
			</script>

			<title>Cat Coding</title>
		</head>
		<body style="height: 100%; width: 100%">
			<script nonce="${nonce}" type="module">
				importShim("${scriptUri}");
			</script>

			<node-projects-designer-view style="height: 100%; width: 100%;"></node-projects-designer-view>
		</body>
		</html>`;
	}

	/*
	private addNewScratch(document: vscode.TextDocument) {
		const json = this.getDocumentAsJson(document);
		const character = CatScratchEditorProvider.scratchCharacters[Math.floor(Math.random() * CatScratchEditorProvider.scratchCharacters.length)];
		json.scratches = [
			...(Array.isArray(json.scratches) ? json.scratches : []),
			{
				id: getNonce(),
				text: character,
				created: Date.now(),
			}
		];

		return this.updateTextDocument(document, json);
	}*/

	/*
	private deleteScratch(document: vscode.TextDocument, id: string) {
		const json = this.getDocumentAsJson(document);
		if (!Array.isArray(json.scratches)) {
			return;
		}

		json.scratches = json.scratches.filter((note: any) => note.id !== id);

		return this.updateTextDocument(document, json);
	}*/

	/*
	private getDocumentAsJson(document: vscode.TextDocument): any {
		const text = document.getText();
		if (text.trim().length === 0) {
			return {};
		}

		try {
			return JSON.parse(text);
		} catch {
			throw new Error('Could not get document as json. Content is not valid json');
		}
	}*/

	/*
	private updateTextDocument(document: vscode.TextDocument, json: any) {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2));

		return vscode.workspace.applyEdit(edit);
	}*/
}