const vscode = acquireVsCodeApi();

//const oldState = vscode.getState();
//vscode.setState({ count: currentCount });


import { DesignerView } from '@node-projects/web-component-designer';
import createDefaultServiceContainer from '@node-projects/web-component-designer/dist/elements/services/DefaultServiceBootstrap.js';
import '@node-projects/web-component-designer/dist/elements/widgets/designerView/designerView.js';
await window.customElements.whenDefined("node-projects-designer-view")
const designerView = <DesignerView>document.querySelector("node-projects-designer-view");
let serviceContainer = createDefaultServiceContainer();
designerView.initialize(serviceContainer);

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'update':
            designerView.parseHTML(message.text)
            break;
    }
});


vscode.postMessage({ type: 'requestUpdate' });



