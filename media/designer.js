// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    const counter = /** @type {HTMLElement} */ (document.getElementById('lines-of-code-counter'));
    console.log('Initial state', oldState);

    let currentCount = (oldState && oldState.count) || 0;
    //counter.textContent = `${currentCount}`;

    setInterval(() => {
        //counter.textContent = `${currentCount++} `;

        // Update state
        vscode.setState({ count: currentCount });
        
        // Alert the extension when the cat introduces a bug
        if (Math.random() < Math.min(0.001 * currentCount, 0.05)) {
            // Send a message back to the extension
            /*vscode.postMessage({
                command: 'alert',
                text: '🐛  on line ' + currentCount
            });*/
        }
    }, 100);

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'refactor':
                currentCount = Math.ceil(currentCount * 0.5);
                //counter.textContent = `${currentCount}`;
                break;
        }
    });
}());


import { CursorLinePointerExtensionProvider, DesignerView } from '../node_modules/@node-projects/web-component-designer/dist/index.js';
import createDefaultServiceContainer from '../node_modules/@node-projects/web-component-designer/dist/elements/services/DefaultServiceBootstrap.js';
import '../node_modules/@node-projects/web-component-designer/dist/elements/widgets/designerView/designerView.js';
//@ts-ignore
await window.customElements.whenDefined("node-projects-designer-view")
const designerView = document.querySelector("node-projects-designer-view");
let serviceContainer = createDefaultServiceContainer();
serviceContainer.designerPointerExtensions.push(new CursorLinePointerExtensionProvider());
//@ts-ignore
designerView.initialize(serviceContainer);
