# Learning Site Themes

The official, portable theme packages for Learning Site Engine 3.x. Themes contain only JSON manifests, CSS, SVG assets, and HTML template documentation; no theme executes JavaScript or Node.js.

## Package structure

Each directory under `themes/` is a versioned package. `theme.json` is the exact object accepted by the Engine's exported `themeSchema`. `manifest.json` adds declarative Editor settings, preview data, component coverage, and file entry points. The Engine consumes `theme.json`; an Editor can consume the rest of the manifest without evaluating code.

## Commands

```sh
npm install
npm run validate
npm test
npm run build
```

`npm run build` compiles the TypeScript tooling and deterministically writes `registry.json`. `npm run release:check` is the release gate; GitHub Actions runs it before packaging every theme directory into a versioned `.tgz` archive.

## Compatibility

Both official themes target `>=3.0.0 <4.0.0`. Their CSS supports the Engine document structure (`header`, `nav`, `main`, `article`, `footer`) and all HTML emitted by the Engine Markdown renderer, including headings, paragraphs, lists, links, images, blockquotes, tables, inline code, code blocks, and horizontal rules. Logical CSS properties and `[dir]` selectors provide first-class LTR and RTL layouts.
