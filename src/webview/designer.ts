const vscode = acquireVsCodeApi();
//@ts-ignore
const workspaceuri = window['__$vscodeWorkspaceUri'];

const url = new URL(import.meta.url);
const path = url.pathname.replace("out/webview/designer.js", "");

import { DomHelper } from '@node-projects/base-custom-webcomponent';
import { DesignerView, IDesignItem, NodeHtmlParserService, PropertyGrid } from '@node-projects/web-component-designer';
import createDefaultServiceContainer from '@node-projects/web-component-designer/dist/elements/services/DefaultServiceBootstrap.js';
await window.customElements.whenDefined("node-projects-designer-view")
const designerView = <DesignerView>document.querySelector("node-projects-designer-view");
const propertyGrid = <PropertyGrid>document.getElementById("propertyGrid");
let serviceContainer = createDefaultServiceContainer();
serviceContainer.register("htmlParserService", new NodeHtmlParserService(path + '/node_modules/@node-projects/node-html-parser-esm/dist/index.js'));
designerView.initialize(serviceContainer);
propertyGrid.serviceContainer = serviceContainer;
propertyGrid.instanceServiceContainer = designerView.instanceServiceContainer;


function findDesignItem(designItem: IDesignItem, position: number): IDesignItem {
    let usedItem = null;
    if (designItem.hasChildren) {
        for (let d of designItem.children()) {
            if (d.parsedNode && d.parsedNode.position) {
                if (d.parsedNode.position.start <= position)
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
        const designItems = await parserService.parse(html, designerView.serviceContainer, designerView.instanceServiceContainer);
        for (let d of designItems)
            fixDesignItemsPaths(d)
        designerView.designerCanvas.setDesignItems(designItems)
    }
}

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'update':
            parseHTML(message.text)
            break;
        case 'changeSelection':
            const pos = message.position;
            const root = designerView.designerCanvas.rootDesignItem;
            const item = findDesignItem(root, pos);
            designerView.instanceServiceContainer.selectionService.setSelectedElements([item]);
            break;
    }
});



vscode.postMessage({ type: 'requestUpdate' });