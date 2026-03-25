import * as vscode from 'vscode';

export interface SerializedOutlineItem {
  id: string;
  label: string;
  detail?: string;
  icon?: string;
  contextValue?: string;
  children?: SerializedOutlineItem[];
}

function convertItems(items: SerializedOutlineItem[]): vscode.CustomEditorOutlineItem[] {
  return items.map(item => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    icon: item.icon ? new vscode.ThemeIcon(item.icon) : undefined,
    contextValue: item.contextValue,
    children: item.children ? convertItems(item.children) : undefined,
  }));
}

export class DesignerOutlineProvider implements vscode.CustomEditorOutlineProvider {
  private readonly _onDidChangeOutline = new vscode.EventEmitter<void>();
  readonly onDidChangeOutline = this._onDidChangeOutline.event;

  private readonly _onDidChangeActiveItem = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeActiveItem = this._onDidChangeActiveItem.event;

  private _items: vscode.CustomEditorOutlineItem[] = [];
  private _webview: vscode.Webview | undefined;

  setWebview(webview: vscode.Webview): void {
    this._webview = webview;
  }

  updateFromWebview(serializedItems: SerializedOutlineItem[]): void {
    this._items = convertItems(serializedItems);
    this._onDidChangeOutline.fire();
  }

  setActive(itemId: string | undefined): void {
    this._onDidChangeActiveItem.fire(itemId);
  }

  provideOutline(_token: vscode.CancellationToken): vscode.CustomEditorOutlineItem[] {
    return this._items;
  }

  revealItem(itemId: string): void {
    this._webview?.postMessage({ type: 'reveal', id: itemId });
  }

  sendCommand(command: string): void {
    this._webview?.postMessage({ type: 'outlineCommand', command });
  }
}
