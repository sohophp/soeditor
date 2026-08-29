# Codex Master Prompt #2 — HTML Document Layer & Semantic Preservation

SoEditor Phase 1 Core is complete and has passed the Phase 1 GO/NO-GO gate.

This task begins **Phase 2: HTML Document Layer**.

The purpose of Phase 2 is to establish a stable HTML parsing, document representation, diagnostics, and serialization layer before implementing visual editing.

Do not implement a visual editor.

Read first:

1. `AGENTS.md`
2. `docs/architecture.md`
3. all accepted ADRs under `docs/decisions/`
4. all completed Phase 1 prompts
5. current packages and public APIs

Preserve all Phase 1 guarantees.

---

# 1. Phase 2 goals

Implement:

```text
HTML source
    ↓
HTML parser
    ↓
SoEditor HtmlTree
    ↓
HTML serializer
    ↓
HTML source
```

The HTML layer must support:

* WHATWG-compatible HTML parsing;
* malformed HTML recovery;
* custom elements;
* comments;
* doctypes;
* HTML/SVG/MathML namespaces;
* source locations;
* parser diagnostics;
* semantic preservation;
* Node.js and browser-compatible ESM usage.

Do not implement editing commands over this tree yet.

---

# 2. Parser dependency

Use:

```text
parse5
```

as the HTML parsing/serialization infrastructure.

Reasons include:

* standards-oriented HTML parsing;
* browser-like HTML tree correction;
* source location information;
* parser error callbacks;
* document and fragment parsing;
* serializer support.

Do not expose parse5 types through SoEditor public APIs.

Do not make third-party SoEditor plugins depend on parse5 AST types.

parse5 is an implementation dependency of:

```text
@soeditor/html
```

not part of the SoEditor extension API.

---

# 3. Package

Create:

```text
packages/html/
```

package:

```text
@soeditor/html
```

It should remain independent from editor UI.

Prefer no dependency on:

```text
@soeditor/core
```

unless there is a demonstrated need.

Avoid:

```text
core ↔ html
```

dependency cycles.

Expected dependency direction later:

```text
@soeditor/core
       ↑

@soeditor/html
       ↑

@soeditor/engine
```

or independent core/html dependencies consumed together by engine.

---

# 4. HTML node model

Define SoEditor-owned HTML node types.

Do not expose parse5 nodes directly.

Minimum model:

```ts
type HtmlNode =
    | HtmlDocument
    | HtmlDocumentFragment
    | HtmlElement
    | HtmlText
    | HtmlComment
    | HtmlDoctype;
```

Use discriminated unions.

Example:

```ts
interface HtmlText {
    readonly type: 'text';

    readonly value: string;

    readonly source?: SourceRange;
}
```

---

# 5. HtmlElement

Define an element representation conceptually similar to:

```ts
interface HtmlElement {
    readonly type: 'element';

    readonly tagName: string;

    readonly namespace: HtmlNamespace;

    readonly attributes:
        readonly HtmlAttribute[];

    readonly children:
        readonly HtmlChildNode[];

    readonly source?: ElementSourceRange;
}
```

Do not distinguish custom elements as a separate node type.

For example:

```html
<product-card
    product-id="123"
>
</product-card>
```

is a normal:

```text
HtmlElement
```

with:

```text
tagName = product-card
```

Whether a visual plugin understands the element is a future editing-layer concern.

---

# 6. Namespace

Support at least:

```ts
type HtmlNamespace =
    | 'html'
    | 'svg'
    | 'mathml';
```

Do not collapse SVG/MathML nodes into normal HTML semantics.

Preserve namespace information when parsing and serializing.

---

# 7. Attributes

Do not model attributes as only:

```ts
Record<string, string>
```

Use an explicit attribute representation:

```ts
interface HtmlAttribute {
    readonly name: string;

    readonly value: string;

    readonly namespace?: string;

    readonly prefix?: string;

    readonly source?: SourceRange;
}
```

Exact namespace/prefix typing may be refined based on actual parse5 behavior.

Primary goals:

* preserve attribute name/value;
* retain custom attributes;
* retain `data-*`;
* retain `aria-*`;
* preserve namespaced attributes;
* support attribute-level diagnostics later.

Do not discard unknown attributes.

---

# 8. Source positions

Define SoEditor-owned source location types.

Use:

```ts
interface SourcePosition {
    readonly line: number;

    readonly column: number;

    readonly offset: number;
}
```

and:

```ts
interface SourceRange {
    readonly start: SourcePosition;

    readonly end: SourcePosition;
}
```

Use consistent semantics:

* line: 1-based
* column: 1-based
* offset: 0-based

Document these conventions.

---

# 9. Element source locations

Where available, preserve enough information for future diagnostics to identify:

* full element range;
* opening tag;
* closing tag;
* individual attributes.

A suitable model may include:

```ts
interface ElementSourceRange
    extends SourceRange {

    readonly startTag?: SourceRange;

    readonly endTag?: SourceRange;

    readonly attributes?:
        ReadonlyMap<
            string,
            SourceRange
        >;
}
```

The exact representation may be adjusted for immutable/public API quality.

Do not expose parse5 `ElementLocation` directly.

---

# 10. Implicit nodes

HTML parsing may create implicit nodes while recovering malformed HTML.

Such nodes may have no source range.

This is valid.

Do not invent fake source positions.

An absent source range may mean:

```text
node was synthesized by parser
```

or otherwise has no direct source span.

Preserve that distinction.

---

# 11. Document and fragment parsing

Support both:

```ts
parser.parseDocument(source)
```

and:

```ts
parser.parseFragment(source)
```

or an equivalent deliberate API.

CMS editors commonly edit HTML fragments rather than complete HTML documents.

Fragment parsing is therefore a first-class requirement.

Do not force fragments into artificial:

```html
<html>
<body>
```

containers in the public SoEditor tree unless explicitly represented internally.

---

# 12. Parser interface

Expose a SoEditor-owned parser interface.

Example:

```ts
interface HtmlParser {

    parseDocument(
        source: string
    ): HtmlParseResult<HtmlDocument>;

    parseFragment(
        source: string
    ): HtmlParseResult<HtmlDocumentFragment>;
}
```

The exact generic shape may be simplified.

Do not expose parser implementation details.

---

# 13. Parse result

Parsing should return both tree and diagnostics.

For example:

```ts
interface HtmlParseResult<T> {

    readonly document: T;

    readonly diagnostics:
        readonly HtmlParseDiagnostic[];
}
```

Do not require a second parse merely to obtain syntax diagnostics.

---

# 14. Parse diagnostics

Map parse5 parse errors into SoEditor-owned diagnostics.

Define:

```ts
interface HtmlParseDiagnostic {
    readonly code: string;

    readonly severity:
        | 'error'
        | 'warning';

    readonly message: string;

    readonly source?: SourceRange;
}
```

Do not expose parse5 error objects directly.

Preserve the original parse error code where useful.

Messages should be stable enough for users but must not become tightly coupled to parse5 internals.

---

# 15. HTML preservation principle

Unknown HTML is valid data unless HTML parsing rules state otherwise.

Do not remove an element merely because SoEditor does not recognize its semantics.

Preserve:

* custom elements;
* custom attributes;
* comments;
* `data-*`;
* `aria-*`;
* SVG;
* MathML;
* ordinary unknown attributes accepted by the parser.

Example:

```html
<product-card
    data-product-id="123"
    custom-property="abc"
>
    Example
</product-card>
```

must remain structurally represented.

---

# 16. Semantic preservation

SoEditor Phase 2 does not guarantee byte-for-byte source preservation.

For example:

```html
<DIV CLASS="Foo">
```

may serialize as:

```html
<div class="Foo">
```

This is acceptable.

The requirement is semantic preservation.

Meaningful nodes or attributes must not disappear merely because they are unknown to SoEditor.

Do not attempt source-format preservation in this phase.

---

# 17. Comments

Preserve comments.

Example:

```html
<!-- CMS:block:123 -->
```

must become:

```text
HtmlComment
```

and survive parse → serialize.

Comments may contain CMS metadata and cannot be treated as disposable formatting.

---

# 18. Doctype

Preserve HTML doctype nodes where parsing a complete document.

Example:

```html
<!doctype html>
```

must have a deliberate tree representation.

---

# 19. No RawHtmlNode in Phase 2

Do not introduce a generic:

```text
RawHtmlNode
```

for normal HTML content.

HTML raw-text/RCDATA/script/style behavior should be handled through the standards parser.

Do not treat:

```text
script
style
textarea
title
```

as arbitrary opaque strings beyond what HTML parsing semantics require.

Future template-language syntax such as Twig or Blade is outside Phase 2.

---

# 20. Template syntax deferred

Do not implement special handling for:

```text
Twig
Blade
Handlebars
Vue templates
JSX
server-side template syntax
```

For example:

```twig
{% if user %}
```

is outside this milestone.

A future template-extension layer may address it.

Do not distort the HTML AST now in anticipation of those systems.

---

# 21. Serializer

Define a SoEditor-owned serializer interface.

Example:

```ts
interface HtmlSerializer {
    serializeDocument(
        document: HtmlDocument
    ): string;

    serializeFragment(
        fragment: HtmlDocumentFragment
    ): string;
}
```

Internally parse5 serialization may be used.

Do not expose parse5 serializer APIs publicly.

---

# 22. Serializer options

Do not introduce a large formatting configuration system.

Phase 2 serializer should focus on:

```text
correct semantic serialization
```

not:

```text
pretty formatting
source formatting
HTML style preferences
```

Prettier/formatter work remains deferred.

Only add serializer options demonstrated necessary by current requirements.

---

# 23. Immutability

SoEditor HTML tree nodes should be treated as immutable public data.

Do not expose freely mutable parser internals.

Avoid returning parse5 objects directly.

Use:

```text
readonly
readonly arrays
```

where appropriate.

Do not implement a complex persistent immutable tree library.

Plain immutable TypeScript structures are sufficient.

---

# 24. Tree identity

Do not add IDs to every node merely because future editing might need them.

Phase 2 is parsing infrastructure.

Stable editing node identity belongs to the later editing engine unless Phase 2 implementation demonstrates an unavoidable need.

Avoid speculative UUIDs.

---

# 25. Tree transformations

Do not implement general tree mutation APIs yet.

No:

```text
insertNode
deleteNode
wrapNode
splitNode
mergeNode
```

Those belong to later editing-engine milestones.

Tests may construct values directly where necessary.

---

# 26. Parser adapter

Hide parse5 conversion logic in internal/adaptor modules.

Conceptually:

```text
parse5.parse()
    ↓
parse5 AST
    ↓
Parse5ToSoEditorAdapter
    ↓
HtmlDocument
```

Serialization may perform:

```text
HtmlDocument
    ↓
SoEditorToParse5Adapter
    ↓
parse5.serialize()
```

or another clean implementation.

Do not allow parse5 objects to leak into exported tree nodes.

---

# 27. Conversion correctness

Be careful about:

* void elements;
* template elements;
* SVG;
* MathML;
* namespaces;
* namespaced attributes;
* text;
* comments;
* doctype;
* fragments;
* implicitly inserted nodes.

Do not special-case only common CMS tags.

Use standards-oriented behavior.

---

# 28. `<template>` support

HTML `<template>` has distinct template content semantics.

Do not accidentally drop template contents.

Ensure parse → SoEditor tree → serialize preserves meaningful template content.

Add a focused regression test.

---

# 29. Security boundary

Parsing is not sanitization.

Do not remove:

```html
<script>
```

during parsing merely because it may be unsafe to execute.

Likewise, parsing:

```html
<img onerror="...">
```

does not mean the attribute is approved for rendering.

Keep these concepts distinct:

```text
parse
preserve
sanitize
render
execute
```

Sanitization and preview execution policy belong to later layers.

Document this explicitly.

---

# 30. Tests

Create comprehensive tests under:

```text
packages/html/tests/
```

Cover at least:

## Basic parsing

* paragraph
* nested elements
* text
* comments
* doctype

## Attributes

* normal attributes
* data attributes
* aria attributes
* custom attributes
* namespaced attributes where supported

## Custom elements

* hyphenated custom element
* nested custom element
* unknown attributes

## Source locations

* element
* text
* comment
* start tag
* end tag
* attributes

## Malformed HTML

Examples should include:

* unclosed elements
* invalid nesting
* implicit element insertion
* parser recovery

Verify diagnostics and tree behavior.

## Fragment parsing

* simple fragment
* multiple top-level nodes
* text + elements
* fragment with custom elements

## Namespace

* SVG
* MathML

## Special HTML behavior

* template
* script
* style
* textarea

## Preservation

Parse → serialize should retain meaningful:

* comments
* custom elements
* attributes
* nested structures

## Round trip

Use:

```text
parse
→ serialize
→ parse
```

and compare semantic structure.

Do not require source strings to be byte-identical.

---

# 31. Semantic comparison helper

Tests may implement an internal helper that compares tree semantics while ignoring:

* source locations;
* parser implementation metadata;
* formatting differences.

Do not export this helper from the package.

---

# 32. Browser compatibility

The package should remain usable from browser bundlers.

Do not rely on Node-only APIs such as:

```text
fs
path
Buffer
```

inside runtime HTML parsing code.

Node is used for tooling/tests, not as a runtime dependency assumption.

---

# 33. Public API

Export only deliberate APIs from:

```text
@soeditor/html
```

Potential public categories:

```text
HtmlNode types
HtmlDocument
HtmlDocumentFragment
HtmlElement
HtmlAttribute
SourcePosition
SourceRange
HtmlParser
HtmlSerializer
HtmlParseResult
HtmlParseDiagnostic
default parser/serializer creation API
```

Do not export:

```text
parse5 AST types
conversion helpers
internal adapters
test utilities
```

---

# 34. Default API

Provide a straightforward usage experience.

For example:

```ts
import {
    parseHtmlFragment,
    serializeHtmlFragment
} from '@soeditor/html';
```

or:

```ts
import {
    createHtmlParser,
    createHtmlSerializer
} from '@soeditor/html';
```

Choose one small coherent API.

Avoid forcing ordinary consumers to manually instantiate low-level adapters.

---

# 35. Example acceptance behavior

The following should work conceptually:

```ts
const result =
    parseHtmlFragment(`
        <product-card
            data-id="123"
        >
            <strong>Hello</strong>
        </product-card>
    `);

const element =
    result.document.children[0];
```

It must remain represented as a normal HTML element.

Serializing the document must retain the custom element and meaningful attribute.

---

# 36. Architecture documentation

Update:

```text
docs/architecture.md
```

with the HTML document layer.

Document:

```text
HTML source
     ↕
@soeditor/html
     ↕
HtmlTree
```

Clarify:

* HTML source is the canonical serialized/persistence format;
* HtmlTree is the structured representation used while parsed;
* parse5 is implementation infrastructure;
* parse5 AST is not SoEditor public API.

---

# 37. ADR

Create:

```text
docs/decisions/0008-html-parser-and-document-representation.md
```

Use the next valid ADR number if necessary.

Record:

## Decision

Use parse5 internally.

Expose SoEditor-owned HTML tree types.

Custom/unknown elements remain normal HtmlElement nodes.

HTML parsing is separate from sanitization.

Semantic preservation is required; byte-for-byte preservation is not.

Source locations are part of the HTML document model.

No general RawHtmlNode is introduced in Phase 2.

---

# 38. Do not modify Core architecture unnecessarily

`@soeditor/core` passed its Phase 1 gate.

Do not redesign Core while implementing HTML.

If HTML requirements expose a genuine missing Core capability:

* document it;
* explain the conflict;
* avoid casually changing Core public API.

Prefer keeping `@soeditor/html` independent.

---

# 39. No Phase 3 work

Do not implement:

* contenteditable
* visual rendering
* DOM synchronization
* Selection
* History
* visual commands
* bold
* italic
* heading editing
* toolbar
* CodeMirror
* Markdown
* Preview
* Formatter
* Accessibility diagnostics
* SEO diagnostics
* Image UI
* Table UI

Phase 2 is exclusively the HTML document infrastructure.

---

# 40. Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Ensure existing Phase 1 tests continue to pass.

Add package-level tests for `@soeditor/html`.

If appropriate, add a packed-package consumer test importing `@soeditor/html` through its public exports.

Do not introduce hidden subpath dependencies.

---

# 41. Completion report

Report:

## Parser

Explain parse5 integration and isolation.

## HtmlTree

Describe public node model.

## Source locations

Explain position semantics and implicit nodes.

## Preservation

Explain custom elements, attributes, comments, SVG/MathML, and malformed HTML behavior.

## Diagnostics

Explain parse error mapping.

## Serializer

Explain round-trip semantics.

## Public API

List the intentional `@soeditor/html` exports.

## Tests

List major test categories and totals.

## Verification

Report:

* lint
* typecheck
* test
* build
* consumer/package checks if added

## Architecture concerns

Identify any unresolved Phase 2 design risks.

Do not begin Phase 3.
