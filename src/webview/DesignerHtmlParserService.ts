import { BaseCustomWebcomponentParserService, IDesignItem, IHtmlParserService, InstanceServiceContainer, NodeHtmlParserService, ServiceContainer } from "@node-projects/web-component-designer";

export class DesignerHtmlParserService implements IHtmlParserService {

	nodeHtmlParserService: NodeHtmlParserService;
	baseCustomWebcomponentParserService: BaseCustomWebcomponentParserService;

	public filename: string = '';

	constructor(path: string) {
		this.nodeHtmlParserService = new NodeHtmlParserService(path + '/node_modules/@node-projects/node-html-parser-esm/dist/index.js');
		this.baseCustomWebcomponentParserService = new BaseCustomWebcomponentParserService(this.nodeHtmlParserService);
	}

	parse(html: string, serviceContainer: ServiceContainer, instanceServiceContainer: InstanceServiceContainer, parseSnippet: boolean): Promise<IDesignItem[]> {
		if (this.filename.endsWith('.ts')) {
			return this.baseCustomWebcomponentParserService.parse(html, serviceContainer, instanceServiceContainer, parseSnippet);
		}
		return this.nodeHtmlParserService.parse(html, serviceContainer, instanceServiceContainer, parseSnippet);
	}
}