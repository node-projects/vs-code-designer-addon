import * as vscode from 'vscode';

export class DesignerTreeView implements vscode.TreeDataProvider<TreeItem>, vscode.TreeDragAndDropController<TreeItem> {

	onDidChangeTreeData?: vscode.Event<TreeItem | null | undefined> | undefined;

	data: TreeItem[];

	constructor() {
		this.data = [new TreeItem('work progress')];
		
		/*const tg1 =vscode.window.tabGroups.onDidChangeTabGroups(e => {
			if (e.changed[0].activeTab?.input.viewType == "designer.designerTextEditor") {

			}
			debugger;
			console.log('tg', e);
		});
		const tg2 =vscode.window.tabGroups.onDidChangeTabs(e => {
			debugger;
			console.log('t', e);
		});*/
		
		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
		});

		const changeActiveTextEditorSubscription  = vscode.window.onDidChangeActiveTextEditor(e => {
		});
	}

	getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
		if (element === undefined) {
			return this.data;
		}
		return element.children;
	}

	dropMimeTypes = ['application/vnd.code.tree.testViewDragAndDrop'];
	dragMimeTypes = ['text/uri-list'];

	handleDrag(source: readonly TreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
		//debugger;
	}

	handleDrop(target: TreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
		//debugger;
	}
}

class TreeItem extends vscode.TreeItem {
	children: TreeItem[] | undefined;

	constructor(label: string, children?: TreeItem[]) {
		super(
			label,
			children === undefined ? vscode.TreeItemCollapsibleState.None :
				vscode.TreeItemCollapsibleState.Expanded);

		this.children = children;
	}
}