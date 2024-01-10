import { IDesignItem, IHtmlParserService, InstanceServiceContainer, ServiceContainer } from "@node-projects/web-component-designer";
//import { BaseCustomWebcomponentParserService } from "@node-projects/web-component-designer-htmlparserservice-base-custom-webcomponent";
import { NodeHtmlParserService } from "@node-projects/web-component-designer-htmlparserservice-nodehtmlparser";

export class DesignerHtmlParserAndWriterService implements IHtmlParserService {

	nodeHtmlParserService: NodeHtmlParserService;
	//baseCustomWebcomponentParserService: BaseCustomWebcomponentParserService;

	public filename: string = '';
	public originalContent: string = '';

	constructor(path: string) {
		this.nodeHtmlParserService = new NodeHtmlParserService();
		//this.baseCustomWebcomponentParserService = new BaseCustomWebcomponentParserService(this.nodeHtmlParserService);
	}

	parse(html: string, serviceContainer: ServiceContainer, instanceServiceContainer: InstanceServiceContainer, parseSnippet: boolean): Promise<IDesignItem[]> {
		this.originalContent = html;
		/*if (this.filename.endsWith('.ts')) {
			return this.baseCustomWebcomponentParserService.parse(html, serviceContainer, instanceServiceContainer, parseSnippet);
		}*/
		return this.nodeHtmlParserService.parse(html, serviceContainer, instanceServiceContainer, parseSnippet);
	}

	write(html: string, css: string): string {
		/*if (this.filename.endsWith('.ts')) {
			return this.baseCustomWebcomponentParserService.writeBack(this.originalContent, html, css, false);
		}*/
		return html;
	}
}