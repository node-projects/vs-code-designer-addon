const vscode = acquireVsCodeApi();

//const oldState = vscode.getState();
//vscode.setState({ count: currentCount });

console.log(import.meta.url)
const url = new URL(import.meta.url);
const path = url.pathname.replace("out/webview/designer.js", "");

import { DesignerView, IDesignItem, NodeHtmlParserService, } from '@node-projects/web-component-designer';
import createDefaultServiceContainer from '@node-projects/web-component-designer/dist/elements/services/DefaultServiceBootstrap.js';
await window.customElements.whenDefined("node-projects-designer-view")
const designerView = <DesignerView>document.querySelector("node-projects-designer-view");
let serviceContainer = createDefaultServiceContainer();
serviceContainer.register("htmlParserService", new NodeHtmlParserService(path + '/node_modules/@node-projects/node-html-parser-esm/dist/index.js'));
designerView.initialize(serviceContainer);

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

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'update':
            designerView.parseHTML(message.text)
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