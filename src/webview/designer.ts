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
import { CommandType, DesignerView, IDesignItem, NodeType, PaletteView, PreDefinedElementsService, PropertyGrid, WebcomponentManifestElementsService, WebcomponentManifestPropertiesService } from '@node-projects/web-component-designer';
import createDefaultServiceContainer from '@node-projects/web-component-designer/dist/elements/services/DefaultServiceBootstrap.js';
import { DesignerHtmlParserAndWriterService } from './DesignerHtmlParserAndWriterService.js';
import { CssParserStylesheetService } from '@node-projects/web-component-designer-stylesheetservice-css-parser';

// --- Outline tree serialization ---

interface SerializedOutlineItem {
    id: string;
    label: string;
    detail?: string;
    icon?: string;
    contextValue?: string;
    children?: SerializedOutlineItem[];
}

let nextOutlineId = 0;
const elementToOutlineId = new WeakMap<Element, string>();
const outlineIdToDesignItem = new Map<string, IDesignItem>();

function getOutlineId(item: IDesignItem): string {
    let id = elementToOutlineId.get(item.element);
    if (!id) {
        id = `el-${nextOutlineId++}`;
        elementToOutlineId.set(item.element, id);
    }
    return id;
}

function buildOutlineTree(item: IDesignItem): SerializedOutlineItem | null {
    if (item.isEmptyTextNode) return null;

    const id = getOutlineId(item);
    outlineIdToDesignItem.set(id, item);

    const children: SerializedOutlineItem[] = [];
    if (item.hasChildren) {
        for (const child of item.children()) {
            const c = buildOutlineTree(child);
            if (c) children.push(c);
        }
    }

    let label: string;
    let icon: string;
    let detail: string | undefined;

    if (item.nodeType === NodeType.TextNode) {
        label = '#text';
        detail = item.content?.substring(0, 60);
        icon = 'symbol-string';
    } else if (item.nodeType === NodeType.Comment) {
        label = '#comment';
        detail = item.content?.substring(0, 60);
        icon = 'comment';
    } else {
        label = item.name;
        if (item.id) detail = '#' + item.id;
        icon = item.isRootItem ? 'layout' : 'symbol-class';
    }

    let contextValue = 'element';
    if (item.lockAtDesignTime) contextValue += ':locked';
    if (item.hideAtDesignTime) contextValue += ':hideDesign';
    if (item.hideAtRunTime) contextValue += ':hideRuntime';

    return {
        id,
        label,
        detail,
        icon,
        contextValue,
        children: children.length > 0 ? children : undefined,
    };
}

function sendOutlineData(rootItem: IDesignItem) {
    outlineIdToDesignItem.clear();
    const tree = buildOutlineTree(rootItem);
    vscode.postMessage({
        type: 'outlineData',
        items: tree ? [tree] : []
    });
}

function sendActiveOutlineItem(selectedElements: IDesignItem[]) {
    const primary = selectedElements.length > 0 ? selectedElements[0] : undefined;
    const id = primary ? elementToOutlineId.get(primary.element) : undefined;
    vscode.postMessage({
        type: 'outlineActiveItem',
        id: id ?? undefined
    });
}

// --- End outline helpers ---

await window.customElements.whenDefined("node-projects-designer-view");
const designerView = <DesignerView>document.querySelector("node-projects-designer-view");
const propertyGrid = <PropertyGrid>document.getElementById("propertyGrid");
const paletteView = <PaletteView>document.getElementById("paletteView");
let serviceContainer = createDefaultServiceContainer();
let designerHtmlParserService = new DesignerHtmlParserAndWriterService(path);
serviceContainer.register("htmlParserService", designerHtmlParserService);
serviceContainer.register("stylesheetService", designerCanvas => new CssParserStylesheetService(designerCanvas));
//@ts-ignore
let json = await import('@node-projects/web-component-designer/config/elements-native.json', { assert: { type: 'json' } })
serviceContainer.register('elementsService', new PreDefinedElementsService('native', json.default));

designerView.initialize(serviceContainer);
propertyGrid.serviceContainer = serviceContainer;
propertyGrid.instanceServiceContainer = designerView.instanceServiceContainer;
paletteView.loadControls(serviceContainer, serviceContainer.elementsServices);

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
let revealFromOutline = false;

window.addEventListener('message', async event => {
    const message = event.data;
    switch (message.type) {
        case 'update':
            parsing = true;
            designerHtmlParserService.filename = message.filename;
            await parseHTML(message.text);
            parsing = false;
            sendOutlineData(designerView.designerCanvas.rootDesignItem);
            break;
        case 'changeSelection':
            const pos = message.position;
            const posEnd = message.positionEnd;
            const root = designerView.designerCanvas.rootDesignItem;
            designerView.instanceServiceContainer.selectionService.setSelectionByTextRange(pos, posEnd);
            break;
        case 'manifests':
            let n = 0;
            for (let m of message.manifests) {
                n++;
                let nm = 'local ' + n;
                let x = await fetch(m);
                const manifest = await x.json();
                serviceContainer.register("elementsService", new WebcomponentManifestElementsService(nm, '', manifest));
                serviceContainer.register("propertyService", new WebcomponentManifestPropertiesService(nm, manifest));
            }
            paletteView.loadControls(serviceContainer, serviceContainer.elementsServices);
            break;
        case 'reveal': {
            const designItem = outlineIdToDesignItem.get(message.id);
            if (designItem) {
                revealFromOutline = true;
                designerView.instanceServiceContainer.selectionService.setSelectedElements([designItem]);
                setTimeout(() => { revealFromOutline = false; }, 50);
            }
            break;
        }
        case 'outlineCommand': {
            handleOutlineCommand(message.command);
            break;
        }
    }
});

function handleOutlineCommand(command: string) {
    const selectedElements = [...designerView.instanceServiceContainer.selectionService.selectedElements];
    if (selectedElements.length === 0) return;

    switch (command) {
        case 'toggleLock':
            for (const item of selectedElements) {
                item.lockAtDesignTime = !item.lockAtDesignTime;
            }
            sendOutlineData(designerView.designerCanvas.rootDesignItem);
            break;
        case 'toggleHideInDesigner':
            for (const item of selectedElements) {
                item.hideAtDesignTime = !item.hideAtDesignTime;
            }
            sendOutlineData(designerView.designerCanvas.rootDesignItem);
            break;
        case 'toggleHideAtRuntime':
            for (const item of selectedElements) {
                item.hideAtRunTime = !item.hideAtRunTime;
            }
            sendOutlineData(designerView.designerCanvas.rootDesignItem);
            break;
        case 'copy':
            designerView.executeCommand({ type: CommandType.copy });
            break;
        case 'cut':
            designerView.executeCommand({ type: CommandType.cut });
            break;
        case 'paste':
            designerView.executeCommand({ type: CommandType.paste });
            break;
        case 'delete':
            designerView.executeCommand({ type: CommandType.delete });
            break;
        case 'rotateLeft':
            designerView.executeCommand({ type: CommandType.rotateCounterClockwise });
            break;
        case 'rotateRight':
            designerView.executeCommand({ type: CommandType.rotateClockwise });
            break;
        case 'toFront':
            designerView.executeCommand({ type: CommandType.moveToFront });
            break;
        case 'moveForward':
            designerView.executeCommand({ type: CommandType.moveForward });
            break;
        case 'moveBackward':
            designerView.executeCommand({ type: CommandType.moveBackward });
            break;
        case 'toBack':
            designerView.executeCommand({ type: CommandType.moveToBack });
            break;
        case 'moveTo': {
            const item = selectedElements[0];
            const coord = designerView.designerCanvas.getNormalizedElementCoordinates(item.element);
            designerView.designerCanvas.zoomPoint(
                { x: coord.x + coord.width / 2, y: coord.y + coord.height / 2 },
                designerView.designerCanvas.zoomFactor
            );
            break;
        }
        case 'jumpTo': {
            const item = selectedElements[0];
            const offset = 10;
            const coord = designerView.designerCanvas.getNormalizedElementCoordinates(item.element);
            const startPoint = { x: coord.x - offset, y: coord.y - offset };
            const endPoint = { x: coord.x + coord.width + offset, y: coord.y + coord.height + offset };
            const rect = {
                x: Math.min(startPoint.x, endPoint.x),
                y: Math.min(startPoint.y, endPoint.y),
                width: Math.abs(startPoint.x - endPoint.x),
                height: Math.abs(startPoint.y - endPoint.y),
            };
            const zFactorWidth = designerView.designerCanvas.outerRect.width / rect.width;
            const zFactorHeight = designerView.designerCanvas.outerRect.height / rect.height;
            const zoomFactor = Math.min(zFactorWidth, zFactorHeight);
            designerView.designerCanvas.zoomPoint(
                { x: coord.x + coord.width / 2, y: coord.y + coord.height / 2 },
                zoomFactor
            );
            break;
        }
    }
}

designerView.instanceServiceContainer.selectionService.onSelectionChanged.on(() => {
    let primarySelection = designerView.instanceServiceContainer.selectionService.primarySelection;
    if (primarySelection) {
        const selectionPosition = designerView.instanceServiceContainer.designItemDocumentPositionService.getPosition(primarySelection);
        vscode.postMessage({ type: 'setSelection', position: selectionPosition });
    }
    // Sync selection to outline (skip if the selection came from the outline itself)
    if (!revealFromOutline) {
        sendActiveOutlineItem([...designerView.instanceServiceContainer.selectionService.selectedElements]);
    }
});
/*designerView.instanceServiceContainer.stylesheetService.stylesheetChanged.on((event) => {
    console.log(event);
});*/
designerView.designerCanvas.onContentChanged.on(() => {
    if (!parsing) {
        let code = designerView.getDesignerHTML();
        let st = designerView.instanceServiceContainer.stylesheetService.getStylesheets()?.find(x => x.name == 'css');
        let css = '';
        if (st) {
            css = st.content;
        }
        code = designerHtmlParserService.write(code, css);
        vscode.postMessage({ type: 'updateDocument', code: code });
        // Rebuild outline tree after content changes
        sendOutlineData(designerView.designerCanvas.rootDesignItem);
    }
})

vscode.postMessage({ type: 'firstLoad' });