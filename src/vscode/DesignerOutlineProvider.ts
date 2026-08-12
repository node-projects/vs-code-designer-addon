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

  interface EditorState {
    items: vscode.CustomEditorOutlineItem[];
    context: vscode.CustomEditorOutlineContext;
  }

  export class DesignerOutlineProvider implements vscode.CustomEditorOutlineProvider {
    private readonly _onDidChangeOutline = new vscode.EventEmitter<vscode.CustomEditorOutlineContext>();
    readonly onDidChangeOutline = this._onDidChangeOutline.event;

    private readonly _onDidChangeActiveItem = new vscode.EventEmitter<{ context: vscode.CustomEditorOutlineContext; itemId: string | undefined }>();
    readonly onDidChangeActiveItem = this._onDidChangeActiveItem.event;

    private readonly _editors = new Map<vscode.WebviewPanel, EditorState>();

    addEditor(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel): void {
      this._editors.set(webviewPanel, { items: [], context: { uri, webviewPanel } });
    }

    removeEditor(webviewPanel: vscode.WebviewPanel): void {
      this._editors.delete(webviewPanel);
    }

    updateFromWebview(webviewPanel: vscode.WebviewPanel, serializedItems: SerializedOutlineItem[]): void {
      const state = this._editors.get(webviewPanel);
      if (state) {
        state.items = convertItems(serializedItems);
        this._onDidChangeOutline.fire(state.context);
      }
    }

    setActive(webviewPanel: vscode.WebviewPanel, itemId: string | undefined): void {
      const state = this._editors.get(webviewPanel);
      if (state) {
        this._onDidChangeActiveItem.fire({ context: state.context, itemId });
      }
    }

    provideOutline(context: vscode.CustomEditorOutlineContext, _token: vscode.CancellationToken): vscode.CustomEditorOutlineItem[] {
      return this._editors.get(context.webviewPanel)?.items ?? [];
    }

    revealItem(context: vscode.CustomEditorOutlineContext, itemId: string): void {
      context.webviewPanel.webview.postMessage({ type: 'reveal', id: itemId });
    }

    sendCommand(resource: vscode.Uri, command: string, itemId?: string): void {
      const editors = [...this._editors.values()].filter(editor => editor.context.uri.toString() === resource.toString());
      const editor = editors.find(candidate => candidate.context.webviewPanel.active) ?? editors[0];
      editor?.context.webviewPanel.webview.postMessage({ type: 'outlineCommand', command, id: itemId });
    }
  }
