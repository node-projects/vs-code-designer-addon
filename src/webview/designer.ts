const vscode = acquireVsCodeApi();
//@ts-ignore
const workspaceuri = window['__$vscodeWorkspaceUri'];

const url = new URL(import.meta.url);
const path = url.pathname.replace("out/webview/designer.js", "");
const filePath= original_url.href.replace("out/webview/designer.js","");
let projectPath= filePath + "project/";

//TODO: vscode does not yet know CSSContainerRule
if (!window.CSSContainerRule)
    //@ts-ignore
    window.CSSContainerRule = class { }

import { DomHelper } from '@node-projects/base-custom-webcomponent';
import { DesignerView, IDesignItem, PaletteView, PreDefinedElementsService, PropertyGrid } from '@node-projects/web-component-designer';
import createDefaultServiceContainer from '@node-projects/web-component-designer/dist/elements/services/DefaultServiceBootstrap.js';
import { DesignerHtmlParserAndWriterService } from './DesignerHtmlParserAndWriterService.js';
import { CssToolsStylesheetService } from '@node-projects/web-component-designer-stylesheetservice-css-tools';

await window.customElements.whenDefined("node-projects-designer-view");
const designerView = <DesignerView>document.querySelector("node-projects-designer-view");
const propertyGrid = <PropertyGrid>document.getElementById("propertyGrid");
const paletteView = <PaletteView>document.getElementById("paletteView");
let serviceContainer = createDefaultServiceContainer();
let designerHtmlParserService = new DesignerHtmlParserAndWriterService(path);
serviceContainer.register("htmlParserService", designerHtmlParserService);
serviceContainer.register("stylesheetService", designerCanvas => new CssToolsStylesheetService(designerCanvas));
//@ts-ignore
let json = await import('@node-projects/web-component-designer/config/elements-native.json', { assert: { type: 'json' } });
serviceContainer.register('elementsService', new PreDefinedElementsService('native', json.default));

function resolveHtmlJsonLib(jsonLib: any, projectPath: string) {
	let elements = jsonLib.elements;
	for (let elementDefinition of elements) {
        if( elementDefinition.iconPath )
        {  // sample entry for elements-custom.json
           // {"tag" : "oneway", 
		   // "defaultWidth": "80px", 
		   // "defaultHeight": "80px", 
	       // "defaultContent": "<eco-rr-oneway style='display: block;'><img style='width:100%;height:100%' src='images/oneway.svg'></eco-rr-oneway>", 
	       // "iconPath": "images/oneway.svg" },
            
            let iconPath = projectPath + elementDefinition.iconPath;
            let html=	
                '<table><tr><td align="left" valign="middle" style="width:16px;height:16px"><img style="width:100%;height:100%" src="' + iconPath + '"></td>' +
                '<td align="left" style="height:16px" >' + elementDefinition.tag + '</td></tr>' +
                '</table>\n';
            elementDefinition.displayHtml = html;
        }
    }
}

let elements_custom_json = await import(projectPath+'elements-custom.json', { assert: { type: 'json' } });
if( elements_custom_json)
{
    resolveHtmlJsonLib(elements_custom_json.default, projectPath);
    serviceContainer.register('elementsService', new PreDefinedElementsService('custom', elements_custom_json.default, projectPath));
}

designerView.initialize(serviceContainer);
propertyGrid.serviceContainer = serviceContainer;
propertyGrid.instanceServiceContainer = designerView.instanceServiceContainer;
paletteView.loadControls(serviceContainer, serviceContainer.elementsServices, projectPath);

function findDesignItem(designItem: IDesignItem, position: number): IDesignItem {
    let usedItem = null;
    if (designItem.hasChildren) {
        for (let d of designItem.children()) {
            const nodePosition = designerView.instanceServiceContainer.designItemDocumentPositionService.getPosition(d);
            if (nodePosition) {
                if (nodePosition.start <= position)
                    usedItem = d;
            }
        }
    }
    if (usedItem) {
        return findDesignItem(usedItem, position)
    }
    return designItem;
}

function fixDesignItemsPaths(designItem: IDesignItem) {
    if (designItem.hasChildren) {
        for (let d of designItem.children()) {
            fixDesignItemsPaths(d);
        }
    }
    if (designItem.name == 'img' && (<HTMLImageElement>designItem.element).src)
        (<HTMLImageElement>designItem.element).src = workspaceuri + designItem.getAttribute('src');
    else if (designItem.name == 'link' && (<HTMLLinkElement>designItem.element).href)
        (<HTMLLinkElement>designItem.element).href = workspaceuri + designItem.getAttribute('href');
}

async function parseHTML(html: string) {
    const parserService = designerView.serviceContainer.htmlParserService;
    if (!html) {
        designerView.instanceServiceContainer.undoService.clear();
        designerView.designerCanvas.overlayLayer.removeAllOverlays();
        DomHelper.removeAllChildnodes(designerView.designerCanvas.overlayLayer);
        designerView.designerCanvas.rootDesignItem.clearChildren();
    }
    else {
        const designItems = await parserService.parse(html, designerView.serviceContainer, designerView.instanceServiceContainer, false);
        for (let d of designItems)
            fixDesignItemsPaths(d)
        designerView.designerCanvas.setDesignItems(designItems)
    }
}

let parsing = true;
window.addEventListener('message', async event => {
    const message = event.data;
    switch (message.type) {
        case 'update':
            parsing = true;
            designerHtmlParserService.filename = message.filename;
            await parseHTML(message.text);
            parsing = false;
            break;
        case 'changeSelection':
            const pos = message.position;
            const root = designerView.designerCanvas.rootDesignItem;
            const item = findDesignItem(root, pos);
            designerView.instanceServiceContainer.selectionService.setSelectedElements([item]);
            break;
    }
});

designerView.instanceServiceContainer.selectionService.onSelectionChanged.on(() => {
    let primarySelection = designerView.instanceServiceContainer.selectionService.primarySelection;
    if (primarySelection) {
        const selectionPosition = designerView.instanceServiceContainer.designItemDocumentPositionService.getPosition(primarySelection);
        vscode.postMessage({ type: 'setSelection', position: selectionPosition });
    }
});
/*designerView.instanceServiceContainer.stylesheetService.stylesheetChanged.on((event) => {
    console.log(event);
});*/
designerView.designerCanvas.onContentChanged.on(() => {
    if (!parsing) {
        let code = designerView.getHTML();
        let st = designerView.instanceServiceContainer.stylesheetService.getStylesheets()?.find(x => x.name == 'css');
        let css = '';
        if (st) {
            css = st.content;
        }
        code = designerHtmlParserService.write(code, css);
        vscode.postMessage({ type: 'updateDocument', code: code });
    }
})

vscode.postMessage({ type: 'requestUpdate' });
