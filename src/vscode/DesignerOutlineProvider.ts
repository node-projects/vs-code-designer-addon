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

  interface ResourceState {
    items: vscode.CustomEditorOutlineItem[];
    webview: vscode.Webview;
  }

  export class DesignerOutlineProvider implements vscode.CustomEditorOutlineProvider {
    private readonly _onDidChangeOutline = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChangeOutline = this._onDidChangeOutline.event;

    private readonly _onDidChangeActiveItem = new vscode.EventEmitter<{ uri: vscode.Uri; itemId: string | undefined }>();
    readonly onDidChangeActiveItem = this._onDidChangeActiveItem.event;

    private readonly _resources = new Map<string, ResourceState>();

    setWebview(resource: vscode.Uri, webview: vscode.Webview): void {
      const state = this._resources.get(resource.toString());
      if (state) {
        state.webview = webview;
      } else {
        this._resources.set(resource.toString(), { items: [], webview });
      }
    }

    removeResource(resource: vscode.Uri): void {
      this._resources.delete(resource.toString());
    }

    updateFromWebview(resource: vscode.Uri, serializedItems: SerializedOutlineItem[]): void {
      const state = this._resources.get(resource.toString());
      if (state) {
        state.items = convertItems(serializedItems);
      }
      this._onDidChangeOutline.fire(resource);
    }

    setActive(resource: vscode.Uri, itemId: string | undefined): void {
      this._onDidChangeActiveItem.fire({ uri: resource, itemId });
    }

    provideOutline(resource: vscode.Uri, _token: vscode.CancellationToken): vscode.CustomEditorOutlineItem[] {
      return this._resources.get(resource.toString())?.items ?? [];
    }

    revealItem(resource: vscode.Uri, itemId: string): void {
      this._resources.get(resource.toString())?.webview?.postMessage({ type: 'reveal', id: itemId });
    }

    sendCommand(resource: vscode.Uri, command: string, itemId?: string): void {
      this._resources.get(resource.toString())?.webview?.postMessage({ type: 'outlineCommand', command, id: itemId });
    }
  }