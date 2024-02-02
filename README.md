# vs-code-designer-addon
A VSCode WYSIWYG HTML Designer Addon.

it is also usable in VSCodeWeb

## addon-page

https://marketplace.visualstudio.com/items?itemName=node-projects.vscode-designer-addon

## references

- based on https://github.com/node-projects/web-component-designer
- sample using the designer: https://node-projects.github.io/web-component-designer-demo/index.html

## supports

- html files
- https://github.com/node-projects/base-custom-webcomponent Components, with css in static style varibale and html in static template variable.
- https://polymer-library.polymer-project.org/ Components.
- https://vuejs.org/ Components with templates in 'template' tags.
- https://svelte.dev/ Components.

## sample image

![sample](sample.gif)

## Open the Designer

- Rightclick on a '.html', '.ts', '.vue' File and Select "Open With", here select "Designer".

## Development of the Extension

- Clone this Repository
- Open the Cloned Repository in VS Code 1.47+
- `npm install`
- `F5` to start debugging

## Test new Versions

- Run 'npm start package', this will start vsce and create a packge wich then you could install localy.
