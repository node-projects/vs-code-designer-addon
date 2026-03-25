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

	export interface CustomEditorOutlineProvider {
		readonly onDidChangeOutline: Event<void>;
		readonly onDidChangeActiveItem: Event<string | undefined>;
		provideOutline(token: CancellationToken): ProviderResult<CustomEditorOutlineItem[]>;
		revealItem(itemId: string): void;
	}

	export namespace window {
		export function registerCustomEditorOutlineProvider(viewType: string, provider: CustomEditorOutlineProvider): Disposable;
	}
}
