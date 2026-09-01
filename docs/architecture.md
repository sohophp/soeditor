# SoEditor CMS Architecture

## Status

This is the active target architecture after the 2026-09-01 CMS-only product
reset. It describes the direction being implemented in Phases 58–62. Historical
packages may not yet match every target boundary.

## Runtime shape

```text
CMS textarea / element
          ↓
   createClassicEditor()
          ↓
  classic toolbar and dialogs
          ↓
       commands
          ↓
 controlled WYSIWYG operations
          ↓
 transaction + history + canonical HTML
          ↓
 textarea / getData() / host save adapter
```

HTML Source is an optional, lazy-loaded second surface. It is never required to
initialize or use the WYSIWYG editor.

## Canonical data

HTML source is the persisted authority. The browser DOM is an editing projection,
not an unrestricted data model.

The editor may maintain a structured representation for selection, commands,
tables, images, widgets and conversion. Ordinary edits should produce bounded,
described operations. Exact source replacement remains available for Source
mode and external `setData()`.

Meaningful unknown elements, attributes, comments and CMS markers survive
round trips. Unsafe content may remain represented but cannot execute in the
authoring surface.

## Layers

### Core

`@soeditor/core` owns lifecycle, immutable state, transactions, commands,
plugins, events, services, configuration and typed errors. It has no browser DOM
or feature UI dependency.

### HTML

`@soeditor/html` parses and serializes HTML through SoEditor-owned public types.
It preserves meaningful unknown source and exposes diagnostics needed for safe
editing. Parsing does not sanitize or execute.

### Editing engine

`@soeditor/engine` and `@soeditor/wysiwyg` currently share editing responsibilities.
Phase 59 will establish one production WYSIWYG ownership boundary and remove the
historical Developer Visual path from the default runtime.

The engine owns:

- controlled contenteditable rendering;
- native selection capture, validation and restoration;
- beforeinput, composition, keyboard, clipboard and drag/drop coordination;
- conversion between canonical HTML and the editing representation;
- bounded repair of unexpected browser mutations;
- transaction descriptions and history integration.

The engine does not own toolbar layout, file storage or CMS persistence.

### CMS features

`@soeditor/rich-text` provides focused command plugins for blocks, marks, lists,
links, images, tables and configured CMS content objects. Features communicate
through commands, services and transactions rather than direct cross-plugin DOM
access.

### UI

`@soeditor/ui` provides the classic toolbar, menus, dialogs, context controls,
notifications and status information. UI reflects command state and invokes
commands. It does not implement independent content mutations.

### Host integrations

Uploads, file selection, SoFinder and save workflows use typed host-owned
adapters. The default editor never assumes a storage backend.

### Optional Source

`@soeditor/source` uses CodeMirror 6 and loads only when configured or first
activated. It synchronizes exact canonical HTML through the same transaction
and history boundary. CodeMirror is not part of the default WYSIWYG critical
path.

## Package tiers

### Default CMS runtime target

- `@soeditor/core`
- `@soeditor/html`
- the consolidated WYSIWYG engine
- focused rich-text features
- classic UI
- the narrow `@soeditor/editor` CMS entry

### Optional CMS integrations

- HTML Source;
- upload/file-manager contracts and SoFinder adapter;
- host save workflow;
- explicitly configured diagnostics or safe media integrations.

### Compatibility-only product families

Markdown, comments, revisions, Preview, layouts, Developer Visual, React/Vue
adapters and plugin scaffolding are not part of the active product. Released
packages remain subject to support and SemVer policy, but default code must not
import them.

## Dependency direction

```text
CMS entry → UI / features / WYSIWYG engine → Core
                   ↓               ↓
              host services      HTML

optional Source → Core / HTML
optional adapters → public service contracts
```

Core never depends upward. Feature packages do not depend on a specific CMS,
file manager or framework. Optional packages cannot be re-exported broadly from
the default entry if that makes them part of its bundle graph.

## Selection and transaction rules

- Validate every stored Range against the active document and editor root.
- Preserve the last valid bookmark while focus moves into editor-owned UI.
- A dialog reads current state before opening and restores focus after apply or
  cancel.
- A user action that changes content creates one meaningful undo step.
- Composition sessions are not fragmented by toolbar polling or synchronization.
- Table cells, captions and list items use the same text-formatting command path
  as paragraphs.
- Source replacement and external data changes remain explicit transaction
  origins.

## Rendering and performance rules

- Do not rebuild the complete editing surface for an ordinary local keystroke.
- Avoid reparsing canonical HTML when a bounded operation already describes the
  change.
- Batch toolbar-state reads and DOM writes; do not scan the full document on
  every selection event.
- Observers, global listeners, timers and tasks are instance-owned and removed
  on destroy.
- Lazy features must have real dynamic import boundaries, not only hidden UI.
- Browser-global and ESM CMS artifacts are measured independently from legacy
  all-features compatibility artifacts.

## Security boundary

The editor separates parsing, preservation, editing presentation and execution.
Scripts do not run. Event-handler attributes do not become live authoring DOM
handlers. URL-bearing features validate protocols. External paste/drop follows
an explicit cleanup and upload policy. Preview is not part of the default
product and cannot be used to weaken the authoring boundary.

## Public API target

The normal integration API is intentionally small:

```ts
const editor = await createClassicEditor(host, options);

editor.getData();
editor.setData(html);
editor.focus();
editor.setReadonly(true);
await editor.destroy();
```

Configuration may select plugins, toolbar items, locale, content styles, upload,
file manager, Source mode and lifecycle callbacks without rebuilding a custom
distribution. Advanced internal registries and compatibility products are not
exported from the default entry.
