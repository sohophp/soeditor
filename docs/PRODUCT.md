# SoEditor Product Definition

## Status

Active product definition, reset on 2026-09-01.

SoEditor is a lightweight, stable HTML WYSIWYG editor for the administration
area of websites and content-management systems.

## Product promise

A CMS developer can attach SoEditor to a textarea or element with little code.
A content author can complete normal page, article, product, and description
editing without understanding HTML. A developer can optionally expose HTML
Source mode without losing meaningful CMS markup.

The product identity is deliberately narrow:

```text
CMS HTML WYSIWYG Editor
    + reliable classic authoring
    + optional HTML source control
    + safe CMS media integration
```

SoEditor learns lightweight delivery from Jodit 4, mature authoring behavior
from CKEditor 4, and model/view/command/plugin separation from CKEditor 5. It
does not attempt to reproduce any one editor or copy its implementation.

## Primary users

- CMS authors editing web content visually;
- administrators maintaining pages and product content;
- developers integrating an editor into forms and Ajax workflows;
- CMS vendors providing upload, file-manager, style, and content-object
  adapters.

## Required workflows

### Integration and lifecycle

- mount on a textarea or element;
- synchronize native form submit and reset;
- support explicit get/set data, readonly, focus, dirty state, save callbacks,
  and exact teardown;
- support multiple isolated instances on one page;
- work without React, Vue, or another application framework.

### Daily authoring

- text input, selection, keyboard navigation, IME, undo and redo;
- paragraphs, headings, inline formatting, semantic styles, alignment,
  indentation, blockquotes, code, rules and page breaks;
- ordered/unordered nested lists;
- links, anchors, files and configured internal targets;
- images with upload/picker/URL, alternative text, caption, size, alignment,
  replacement and links;
- HTML tables with captions, headers, row/column operations, merge/split,
  properties and keyboard navigation;
- special characters and configured inert CMS placeholders or objects.

### CMS content handling

- preserve existing meaningful HTML, comments, classes, attributes, custom
  elements, and CMS markers;
- keep unsafe content inert while retaining source where policy permits;
- clean external Word, spreadsheet, document-editor, web, and plain-text paste
  predictably;
- allow a host-owned upload service and replaceable file manager;
- optionally expose HTML Source mode as a lazy-loaded feature.

### User interface

- conventional configurable toolbar;
- focused link, image, table, and content-object dialogs;
- unobtrusive contextual tools;
- responsive/narrow/mobile operation;
- English, Simplified Chinese, Traditional Chinese, custom localization, RTL,
  keyboard, zoom, and high-contrast support.

## Default versus optional

The default CMS distribution contains only the functionality required for the
workflows above. Optional functionality must use explicit entry points and must
not increase default startup or bundle cost.

HTML Source is the only alternate editing mode in the active product direction.
It is optional and loaded on demand.

Focused integrations such as SoFinder, custom save adapters, safe media embeds,
or advanced diagnostics may remain separate optional packages.

## Non-goals

The active product and roadmap exclude:

- Markdown editing and conversion;
- comments, review workflows, track changes and revision history;
- real-time collaboration and presence;
- AI writing, generation, review or agents;
- Developer Visual, IDE-style inspectors and command palettes;
- Preview workspaces, split-pane layouts and arbitrary docking;
- page builders, office-style pagination, spreadsheets, formulas and charts;
- email-authoring/client-optimization modes;
- framework-specific editor architecture;
- hosted marketplaces and speculative extension tooling.

Previously published packages covering some of these areas are compatibility
surfaces, not current product priorities. They may be deprecated separately
under SemVer and must remain outside the default CMS load path.

## HTML contract

HTML is canonical persistence data. SoEditor targets semantic preservation, not
byte-for-byte serialization.

Unknown does not mean invalid. Invalid does not mean unsafe. Unsafe does not mean
the source may be discarded. Unsupported visual behavior does not mean content
may disappear.

Existing CMS HTML is preserved unless the author intentionally changes it or an
explicit host policy says otherwise. External paste cleanup does not silently
rewrite stored content. Preserved scripts, event handlers, unsafe URLs and
embeds never receive permission to execute in the editing surface.

## Quality promise

A feature is complete only when its complete author journey works with real
pointer, keyboard, selection, clipboard, history, Source round trip when
enabled, form synchronization, readonly, multiple instances and teardown.

Automated Chromium, Firefox and WebKit evidence is required. Real Safari and
assistive-technology behavior must remain explicitly unclaimed until manually
verified.

Performance is a product feature. New functionality may not routinely raise
budgets. Default bundle size, startup, typing latency, paste latency, memory,
large-document behavior and repeated lifecycle cleanup are release gates.
