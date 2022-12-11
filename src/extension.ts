import * as vscode from 'vscode';
import { TreeDataProvider } from './TreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
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
	}

	vscode.window.registerTreeDataProvider("exampleView", new TreeDataProvider)
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions & vscode.WebviewPanelOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,
		retainContextWhenHidden: true

		// And restrict the webview to only loading content from our extension's `media` directory.
		//localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media'),vscode.Uri.joinPath(extensionUri, 'node_modules')]
	};
}

/**
 * Manages cat coding webview panels
 */
class DesignerPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: DesignerPanel | undefined;

	public static readonly viewType = 'designer';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (DesignerPanel.currentPanel) {
			DesignerPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			DesignerPanel.viewType,
			'Designer',
			column || vscode.ViewColumn.One,
			getWebviewOptions(extensionUri),
		);


		DesignerPanel.currentPanel = new DesignerPanel(panel, extensionUri);
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		DesignerPanel.currentPanel = new DesignerPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					//this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' });
	}

	public dispose() {
		DesignerPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.title = 'Designer';
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'designer.js');

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Local path to css styles
		const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');

		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en" style="height: 100%; width: 100%">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<metaaaa http-equiv="aaaContent-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">

				<script src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, '/node_modules/construct-style-sheets-polyfill/dist/adoptedStyleSheets.js'))}"></script>
				<script type="esms-options">
				  {
					"shimMode": true
				  }
				</script>
				<script src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, '/node_modules/es-module-shims/dist/es-module-shims.js'))}"></script>
				<script>
				  const importMap = {
					imports: {
					  "@node-projects/base-custom-webcomponent": "${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, '/node_modules/@node-projects/base-custom-webcomponent/dist/index.js'))}",
					  "@node-projects/base-custom-webcomponent/": "${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, '/node_modules/@node-projects/base-custom-webcomponent/'))}",
					  "jquery.fancytree/": "./node_modules/jquery.fancytree/",
					  "monaco-editor/": "./node_modules/monaco-editor/"
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

				<node-projects-designer-view style="height: 100%; width: 100%;">
					<button style="width:100px;height:30px;position:absolute;top:192px;left:365px;">Button</button>
					<div style="position:absolute;top:161px;left:149px;">Default Text 2</div>
					<div style="position:absolute;width:20px;height:20px;top:301px;left:507px;background:red;"></div>
					<button style="width:100px;height:30px;position:absolute;top:385px;left:507px;">Button</button>
					<button style="width:154.23px;height:103.645px;position:absolute;top:256px;left:625px;">Button</button>
					<svg style="position:absolute;left:326px;top:343px;width:554px;height:441px;">
						<path d="
					M 50 150 C70  250 , 130 250 ,150 150 
					M150 150 C170 50 ,  230 50 , 250 150 
					M250 150 C270 250 , 330 250 ,350 150
					M350 150 C370 50 ,  430 50 , 450 150
					M450 150 C470 250 , 530 250 ,550 150" fill="hsla(0,0%,75%,0.5)" stroke="black" stroke-width="2" style="position:absolute;left:-50px;top:33px;"></path>
					</svg>
					<div style="display: grid; column-gap: 5px; row-gap: 5px; grid-template-columns: 60px 120px 120px; grid-template-rows: 50px 50px 50px; height: 150px; width: 300px; top: 400px; left: 30px; position: absolute;">
					<button></button>
					<input type="range" style="width: 100%; height: 100%;">

					</div>
				</node-projects-designer-view>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
