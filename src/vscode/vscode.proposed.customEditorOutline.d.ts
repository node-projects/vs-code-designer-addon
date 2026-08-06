declare module 'vscode' {

	export interface CustomEditorOutlineItem {
		readonly id: string;
		readonly label: string;
		readonly detail?: string;
		readonly tooltip?: string;
		readonly icon?: ThemeIcon;
		readonly contextValue?: string;
		readonly children?: CustomEditorOutlineItem[];
	}

	export interface CustomEditorOutlineContext {
		readonly uri: Uri;
		readonly webviewPanel: WebviewPanel;
	}

	export interface CustomEditorOutlineProvider {
		readonly onDidChangeOutline: Event<CustomEditorOutlineContext>;
		readonly onDidChangeActiveItem: Event<{ context: CustomEditorOutlineContext; itemId: string | undefined }>;
		provideOutline(context: CustomEditorOutlineContext, token: CancellationToken): ProviderResult<CustomEditorOutlineItem[]>;
		revealItem(context: CustomEditorOutlineContext, itemId: string): void;
	}

	export namespace window {
		export function registerCustomEditorOutlineProvider(viewType: string, provider: CustomEditorOutlineProvider): Disposable;
	}
}
