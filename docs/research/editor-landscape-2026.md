# Editor landscape evidence for SoEditor 0.7–1.0

## Purpose

This review informs sequencing after the verified SoEditor 0.6 candidate. It
studies public architecture and product patterns, not source code to copy.
SoEditor remains independently implemented under its HTML-first, plugin-first,
command-driven constraints.

## Primary references reviewed

- CKEditor 5: [editing engine](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html),
  [schema](https://ckeditor.com/docs/ckeditor5/latest/framework/deep-dive/schema.html),
  [conversion](https://ckeditor.com/docs/ckeditor5/latest/framework/deep-dive/conversion/intro.html),
  [custom components](https://ckeditor.com/docs/ckeditor5/latest/features/custom-components.html),
  [General HTML Support](https://ckeditor.com/docs/ckeditor5/latest/features/html/general-html-support.html),
  [collaboration](https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/collaboration.html),
  and [watchdog](https://ckeditor.com/docs/ckeditor5/latest/features/watchdog.html).
- ProseMirror: [guide](https://prosemirror.net/docs/guide/) and
  [examples](https://prosemirror.net/examples/), including node views,
  embedded editors, mapped transforms, annotations, and collaboration.
- Tiptap: [extensions](https://tiptap.dev/docs/editor/core-concepts/extensions)
  and [node views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views).
- TinyMCE: [schema API](https://www.tiny.cloud/docs/tinymce/latest/apis/tinymce.html.schema/)
  and [revision history](https://www.tiny.cloud/docs/tinymce/latest/revisionhistory/).
- Lexical: [framework overview](https://lexical.dev/) and its modular
  node/plugin/editor-state direction.

References were checked on 2026-08-30. Product packaging and commercial
availability can change; only architectural patterns are used here.

## Findings

### Structured content precedes complex features

CKEditor 5, ProseMirror, Tiptap, and Lexical all make typed document nodes and
feature-driven extensions the basis for tables, media, custom components, and
selection behavior. CKEditor 5 and ProseMirror explicitly separate document
meaning from editing DOM. Tiptap node views likewise separate in-editor UI from
serialized output.

SoEditor 0.6 already has a controlled internal editing representation, but its
public extension boundary cannot yet introduce a structured custom block,
atomic widget, nested editable, or conversion rules. Adding isolated feature
buttons before this boundary would deepen hard-coded engine behavior.

### Preservation and editability must remain separate

Schema-driven editors commonly recognize only configured content. CKEditor 5
General HTML Support broadens the recognized set but still requires explicit
configuration. SoEditor must retain its stronger rule: unknown HTML survives
even when no visual feature can edit it.

The 0.7 design therefore needs three explicit outcomes for source content:

1. structured and editable;
2. recognized but atomic/readonly in Visual;
3. unknown and opaquely preserved.

None of these classifications grants executable HTML permission.

### Replayable changes enable later review and collaboration

ProseMirror connects recorded transforms to history and collaborative editing.
CKEditor 5 uses model operations and mapped markers for comments, suggestions,
and presence. Current SoEditor transactions safely replace canonical source,
but snapshot-only changes cannot robustly map annotations or merge concurrent
editing.

0.7 should introduce only the granular structured operations demonstrated by
custom blocks/tables and preserve source replacements as a supported escape
hatch. 0.8 can then prove range mapping through comments and revisions. A
real-time protocol should not be promised until those operations and mappings
survive actual Source/Visual/Markdown workflows.

### Asynchronous review is independently valuable

CKEditor 5 separates comments, track changes, revision history, and real-time
collaboration; TinyMCE revision history is also integrated through host storage
callbacks. SoEditor can deliver comments and revision history through typed
storage/service adapters without owning a backend or requiring simultaneous
editing.

Track changes affects every editing operation and source-mode policy. It should
follow mapped annotations rather than be bundled into the first comments
milestone. Real-time multi-user editing is a separate post-1.0 candidate unless
0.8 evidence justifies activating it sooner.

### Framework adapters and recovery belong above stable lifecycle APIs

TinyMCE and CKEditor provide thin framework integrations. CKEditor watchdog
recovery requires ownership of the editor creator/destructor boundary. SoEditor
should first provide a framework-neutral workspace/mount controller that owns
exactly the surfaces an application requests. React/Vue adapters can then wrap
that controller without making either framework an editor dependency.

Recovery must never silently discard unsaved source or restart repeatedly. It
belongs in an opt-in application package with bounded retries and observable
failure state, not Core.

## Recommended sequence

| Release | Product proof                                                                                                             | Why now                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0.7     | Extensible structured editing, node views/widgets, production tables/media                                                | Removes the largest 0.6 product limitation and creates the operation/conversion basis required downstream. |
| 0.8     | Mapped annotations, comments, revision adapters, review permissions                                                       | Proves stable positions and host-owned review data before considering simultaneous writers.                |
| 0.9     | Framework-neutral workspace, React/Vue adapters, recovery, plugin tooling, large-document budgets                         | Makes integration repeatable only after content and review lifecycle boundaries exist.                     |
| 1.0     | Public API stabilization, compatibility policy, security/accessibility/performance qualification, complete migration/docs | Freezes evidence-backed APIs rather than speculative ones.                                                 |

Real-time collaboration, track changes, AI authoring, arbitrary docking, and a
hosted marketplace remain candidates, not implied 1.0 requirements. They may
be activated by a deliberate ADR if earlier release evidence supplies a safe
model and a concrete user requirement.
