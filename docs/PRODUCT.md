# SoEditor Product Definition

## Status

Active product definition.

This document defines what SoEditor is intended to become.

Implementation details belong in `docs/architecture.md` and accepted ADRs under `docs/decisions/`.

The development roadmap is defined in `docs/ROADMAP.md`.

---

# 1. Product Vision

SoEditor is an HTML-first, extensible rich-text editor for web content
management systems.

Its primary product is a classic, directly embeddable editing experience for
content authors and CMS integrators. Developer-oriented source editing,
diagnostics, preview, Markdown, and extension capabilities remain important
differentiators, but they do not take priority over the ordinary CMS authoring
workflow.

The long-term product identity is:

```text
Classic CMS Rich-Text Editor
        +
HTML Developer Control
        +
Safe Media and Content Workflows
        +
Plugin Platform
```

SoEditor is not intended to be a clone of CKEditor 4, CKEditor 5, TinyMCE,
VSCode, CodeMirror, or another existing editor.

It may learn from successful architectural concepts while maintaining its own implementation and public API.

The author-facing WYSIWYG product is specified separately in
[`wysiwyg-editor.md`](wysiwyg-editor.md). Developer Visual is an HTML developer
tool and must not be treated as, or used to qualify, the WYSIWYG editor.

---

# 2. Product Principles

SoEditor follows these product principles.

## HTML-first

HTML is a first-class persistence format.

Users must retain meaningful HTML even when SoEditor does not provide specialized visual editing behavior for it.

Unknown custom elements and attributes must not disappear merely because an editor feature does not recognize them.

---

## CMS-first, developer-controlled

The default product path should let a CMS replace a textarea or mount a classic
editor without manually assembling engines, UI surfaces, and lifecycle
controllers. Ordinary authors should be able to format text, paste office
content, manage links, images, and tables, and submit the result without using
Source mode.

Developers must still retain direct control over content and integration.

Developer-oriented capabilities include:

- source editing;
- syntax awareness;
- diagnostics;
- formatting;
- element inspection;
- source locations;
- Problems panel;
- command palette;
- preview templates;
- custom CSS;
- plugin APIs.

---

## Plugin-first

Ordinary editor features should normally be implemented as plugins.

The editor core should remain infrastructure rather than become a collection of every feature.

---

## Command-driven

A feature should normally expose behavior through commands so that the same action can be invoked from:

- toolbar;
- keyboard shortcut;
- menu;
- context menu;
- command palette;
- plugin;
- external application code.

---

## Framework-agnostic

The core editor must not depend on React, Vue, Svelte, Angular, or another application framework.

Framework adapters may be provided separately.

---

## Configurable without rebuilding

SoEditor should preserve one of the strongest usability characteristics of CKEditor 4:

> applications should be able to configure normal editor functionality without building a custom editor distribution.

Typical configuration should allow applications to choose:

- plugins;
- toolbar items;
- editor modes;
- content CSS;
- preview CSS;
- preview templates;
- file manager adapters;
- diagnostics;
- keyboard shortcuts;
- presets.

---

# 3. Primary Users

SoEditor is primarily intended for:

## Content authors and administrators

Users who create and maintain web pages, articles, product descriptions, and
other CMS-managed HTML through a visual editor.

## CMS developers

Developers integrating rich content editing into custom content-management systems.

## Web developers

Developers who require visual editing without losing direct HTML control.

## Plugin developers

Developers building additional editor features or integrations.

---

# 4. Primary Use Cases

SoEditor should support the following major use cases.

## Traditional rich-text editing

Users can edit normal web content visually.

Expected features include:

- paragraphs;
- headings;
- bold;
- italic;
- underline;
- strike-through;
- links;
- lists;
- blockquotes;
- inline code;
- code blocks;
- images;
- tables.

The complete CMS workflow also includes configurable styles, semantic external
paste cleanup, image upload, file-manager selection, property dialogs,
responsive toolbars, form synchronization, localization, and accessible
keyboard operation.

---

## HTML source editing

Users can inspect and edit the underlying HTML using a real source editor.

Expected capabilities include:

- syntax highlighting;
- indentation;
- search;
- HTML diagnostics;
- formatting;
- source locations;
- navigation between diagnostics and source.

CodeMirror 6 is the preferred source-editing engine unless an accepted ADR changes this decision.

---

## Markdown editing

Markdown should become a first-class document mode rather than a simple HTML export feature.

Markdown support should eventually include:

- source editing;
- preview;
- common Markdown extensions;
- raw HTML passthrough where appropriate.

SoEditor does not promise perfectly lossless HTML ↔ Markdown conversion.

---

## Preview

Content should be previewable in an isolated environment.

Applications should eventually be able to configure:

- content CSS;
- preview CSS;
- complete preview templates;
- preview context variables;
- page-like rendering.

Preview must be isolated from the editor UI.

A sandboxed iframe is the preferred architecture.

---

## HTML developer tooling

SoEditor should eventually provide developer-oriented capabilities such as:

- HTML Problems panel;
- parser diagnostics;
- accessibility diagnostics;
- formatting;
- element path;
- element inspector;
- document outline;
- command palette.

---

## File management

Media features should depend on a generic file-manager capability rather than a specific product.

SoEditor should eventually support adapters such as:

```text
SoFinder
custom CMS file manager
S3-compatible manager
other external managers
```

SoEditor itself must not depend directly on SoFinder.

---

# 5. Editing Modes

The intended editor modes are:

```text
Visual
Source
Markdown
Preview
```

Later versions may support split layouts such as:

```text
Visual | Source
Source | Preview
Markdown | Preview
```

Split view is not required for the earliest usable release unless the roadmap explicitly schedules it.

---

# 6. HTML Preservation Contract

SoEditor aims for semantic HTML preservation.

It does not promise byte-for-byte preservation.

The following transformation is acceptable:

```html
<div class="Example"></div>
```

to:

```html
<div class="Example"></div>
```

The following is not acceptable merely because SoEditor lacks a specialized plugin:

```html
<product-card data-product-id="123"></product-card>
```

becoming:

```html

```

or being replaced by unrelated markup.

Comments may contain meaningful CMS information and must not be discarded automatically.

Example:

```html
<!-- CMS:block:start -->
```

---

# 7. Custom Elements

Custom HTML elements are normal HTML content.

For example:

```html
<product-card></product-card>
```

must be representable even without a Product Card plugin.

A future plugin may enhance the element visually.

Without such a plugin, SoEditor should preserve the element and provide reasonable generic behavior.

---

# 8. HTML Security

HTML preservation does not imply execution permission.

SoEditor distinguishes:

```text
parse
preserve
sanitize
render
execute
```

Potentially dangerous HTML may remain represented in source while later rendering environments prevent execution.

Security rules must never be weakened merely to maximize HTML freedom.

---

# 9. Plugin Platform

SoEditor should evolve into a plugin platform.

Plugins should eventually be able to contribute capabilities such as:

- commands;
- toolbar items;
- menus;
- context-menu items;
- keyboard shortcuts;
- status-bar entries;
- diagnostics;
- formatters;
- preview providers;
- inspectors;
- file-manager integrations.

A future plugin SDK may provide scaffolding such as:

```bash
npm create soeditor-plugin
```

This is not required until scheduled by the roadmap.

---

# 10. Command Palette

SoEditor should eventually provide a developer-oriented command palette similar in concept to modern development tools.

Example commands:

```text
Format Document
Validate HTML
Toggle Source Mode
Open Preview
Insert Image
Insert Table
Inspect Element
```

The palette must call the same command APIs used by toolbar and shortcuts.

---

# 11. Status Bar

A later UI milestone may provide a status bar containing information such as:

```text
p > strong > a     HTML     Problems: 2     Words: 325
```

This is a secondary feature and must not drive core architecture prematurely.

---

# 12. Diagnostics

Diagnostics should eventually include separate providers for:

```text
HTML parser errors
HTML structural issues
Accessibility
Security
SEO
Plugin-specific validation
```

Diagnostics must be extensible.

Parser diagnostics are infrastructure; higher-level diagnostics should normally be plugins.

---

# 13. Formatting

HTML formatting should use a mature formatter rather than a custom formatter implementation.

Prettier is the preferred HTML formatting foundation unless an accepted ADR changes this decision.

Formatting belongs outside `@soeditor/core`.

---

# 14. Source Editor

SoEditor must not implement its own general-purpose code editor.

CodeMirror 6 is the preferred source-editing foundation.

SoEditor owns:

- synchronization;
- editor modes;
- diagnostics integration;
- formatting commands;
- plugin integration;
- document lifecycle.

CodeMirror owns general code-editing behavior.

---

# 15. Visual Editing

Visual editing should use modern controlled editing architecture.

SoEditor must not base its editing engine on deprecated `document.execCommand()` behavior.

Raw browser DOM mutation must not become the unrestricted authoritative editor state.

The visual engine may use DOM/contenteditable as an editing surface while maintaining controlled structured state and transactions.

---

# 16. Preview Environment

Preview should eventually support configuration similar to:

```ts
preview: {
    css: [
        '/site.css',
        '/article.css'
    ],

    template: `
        <!doctype html>
        <html>
        <body>
            <main class="article">
                {{ content }}
            </main>
        </body>
        </html>
    `
}
```

The exact template API will be defined by the appropriate architecture milestone.

---

# 17. Presets

SoEditor should eventually provide presets such as:

```text
classic
minimal
developer
markdown
```

Example:

```ts
SoEditor.create(element, {
    preset: 'developer',
});
```

Presets are configuration bundles, not separate editor architectures.

---

# 18. Package and Distribution Goals

SoEditor should ultimately support:

```text
TypeScript
ES modules
npm
tree shaking
type declarations
browser bundlers
CDN/browser build
```

Likely package families include:

```text
@soeditor/core
@soeditor/html
@soeditor/engine
@soeditor/ui

@soeditor/plugin-*
@soeditor/adapter-*
```

Exact package boundaries may evolve through accepted ADRs.

---

# 19. Framework Integrations

Framework-specific wrappers may eventually be provided:

```text
@soeditor/react
@soeditor/vue
```

They are not required for the initial 0.5 target unless they become inexpensive after the main API stabilizes.

The framework-neutral JavaScript API remains primary.

---

# 20. SoFinder Integration

SoEditor and SoFinder are separate products.

Integration should use a generic capability:

```text
Image Plugin
    ↓
FileManager API
    ↑
SoFinder Adapter
```

A possible package is:

```text
@soeditor/adapter-sofinder
```

This must not make SoFinder a dependency of SoEditor core.

---

# 21. Non-Goals for Version 0.5

The 0.5 target does not require:

- real-time collaborative editing;
- comments;
- track changes;
- Microsoft Word compatibility;
- pagination/print layout;
- spreadsheet-grade tables;
- AI authoring;
- complete office-suite behavior;
- perfect HTML byte preservation;
- perfect HTML ↔ Markdown conversion;
- arbitrary template-language parsing;
- source-preserving incremental serialization.

These may be considered later.

---

# 22. Version 0.5 Product Target

Version 0.5 should be a credible developer preview suitable for real experimentation and controlled integrations.

The intended capability set includes:

- visual editing;
- common rich-text features;
- HTML source editing;
- HTML preservation;
- diagnostics;
- formatting;
- preview;
- Markdown;
- extensible commands/plugins;
- configurable toolbar/UI;
- file-manager abstraction;
- SoFinder reference integration;
- npm distribution;
- CDN/browser distribution;
- documentation;
- playground/examples.

0.5 does not mean API stability equivalent to 1.0.

Breaking changes remain possible but must be deliberate and documented.
