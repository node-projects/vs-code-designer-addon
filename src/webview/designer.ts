const vscode = acquireVsCodeApi();
//@ts-ignore
const workspaceuri = window['__$vscodeWorkspaceUri'];

const url = new URL(import.meta.url);
const path = url.pathname.replace("out/webview/designer.js", "");

//TODO: vscode does not yet know CSSContainerRule
if (!window.CSSContainerRule)
    //@ts-ignore
    window.CSSContainerRule = class { }

import { DomHelper } from '@node-projects/base-custom-webcomponent';
import { CssToolsStylesheetService, DesignerView, IDesignItem, NodeHtmlParserService, PropertyGrid } from '@node-projects/web-component-designer';
import createDefaultServiceContainer from '@node-projects/web-component-designer/dist/elements/services/DefaultServiceBootstrap.js';
import { DesignerHtmlParserService } from './DesignerHtmlParserService.js';

await window.customElements.whenDefined("node-projects-designer-view")
const designerView = <DesignerView>document.querySelector("node-projects-designer-view");
const propertyGrid = <PropertyGrid>document.getElementById("propertyGrid");
let serviceContainer = createDefaultServiceContainer();
let designerHtmlParserService = new DesignerHtmlParserService(path);
serviceContainer.register("htmlParserService", designerHtmlParserService);
serviceContainer.register("stylesheetService", designerCanvas => new CssToolsStylesheetService(designerCanvas));
designerView.initialize(serviceContainer);
propertyGrid.serviceContainer = serviceContainer;
propertyGrid.instanceServiceContainer = designerView.instanceServiceContainer;

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
            debugger;
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
designerView.designerCanvas.onContentChanged.on(() => {
    if (!parsing) {
        const code = designerView.getHTML();
        vscode.postMessage({ type: 'updateDocument', code: code });
    }
})

vscode.postMessage({ type: 'requestUpdate' });