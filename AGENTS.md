# AGENTS.md

# SoEditor Repository Instructions

These instructions apply to the whole repository unless a more specific
`AGENTS.md` exists below a directory.

## 1. Product boundary

SoEditor is a lightweight, stable HTML WYSIWYG editor for website CMS
administration. Its primary use is replacing a textarea or mounting on an
element so authors can edit the HTML body of articles, pages, products, and
similar CMS records.

Product references have distinct purposes:

- Jodit 4: lightweight packaging, quick startup, direct integration, and a
  complete practical toolbar;
- CKEditor 4: mature CMS behavior, predictable forms, stable selection, paste,
  links, images, tables, dialogs, and long-running editor instances;
- CKEditor 5: internal separation of model, view, commands, conversion, plugins,
  and testable transactions.

Study public behavior and architecture. Do not copy implementation source.

SoEditor is not a page builder, office suite, Markdown product, developer IDE,
collaboration platform, review system, email designer, or AI writing product.
Those directions must not influence the default editor or active roadmap.

## 2. Product priorities

When choices conflict, use this order:

1. editing correctness and content safety;
2. stability over repeated real CMS use;
3. complete ordinary author workflows;
4. low startup, input, memory, and bundle cost;
5. simple integration and configuration;
6. maintainability and testability;
7. optional extensibility;
8. implementation convenience.

A smaller dependable editor is preferred to a broad platform.

## 3. Default CMS feature set

The default editor may include only capabilities required for CMS HTML body
editing:

- paragraphs, headings, inline styles, alignment, indentation and blockquote;
- ordered and unordered lists;
- links, anchors, and file links;
- images, upload, and a replaceable asset picker;
- production HTML tables;
- horizontal rules, page breaks, special characters, and configured CMS
  placeholders;
- semantic external paste cleanup, including common office content;
- undo/redo, keyboard operation, localization, IME, responsive UI, readonly,
  form submit/reset, dirty state, and safe teardown;
- optional HTML Source mode, loaded only when requested;
- preservation of unknown CMS HTML without executing it.

Features such as video, arbitrary embeds, templates, diagnostics, preview, or
save adapters may exist as focused optional plugins when a real CMS integration
requires them. They must not increase the default path.

## 4. Explicit non-goals

Do not add or expand these capabilities without a new owner-approved product
decision that supersedes this file:

- AI authoring or AI review;
- real-time collaboration, comments, track changes, or revision workflows;
- Markdown editing or HTML/Markdown conversion;
- Developer Visual, IDE-like inspectors, command palettes, or arbitrary docking;
- page building, page-layout simulation, spreadsheets, formulas, or charts;
- email-client authoring and optimization;
- framework-specific UI architecture;
- hosted plugin marketplaces or speculative plugin tooling.

Existing packages for historical compatibility may be maintained while they are
publicly supported, but receive only security, compatibility, and critical bug
fixes. They must be tree-shakeable or separately imported and must not be loaded
by the default CMS editor.

## 5. HTML and security contract

HTML is the canonical persisted format. Preserve meaningful elements,
attributes, classes, comments, custom elements, CMS markers, and configured
placeholders whenever the user did not intentionally remove them.

Distinguish unknown, invalid, unsafe, readonly, and unsupported-visually. These
states are not equivalent.

Preservation never grants execution. Scripts, event handlers, unsafe URLs,
iframes, and executable embeds must remain inert in the authoring surface. Paste
cleanup applies to external input, not silently to already stored CMS content.

Semantic preservation is required; byte-for-byte serialization is not.

## 6. Architecture constraints

- Keep `@soeditor/core` small, DOM-free, framework-independent, and free of
  feature implementations.
- User actions flow through commands and transactions. Toolbar and dialogs must
  not mutate canonical content directly.
- Use a controlled editing representation; do not base the editor on deprecated
  `document.execCommand()` behavior.
- Plugins use explicit lifecycle APIs and stable services. Avoid global mutable
  state and access to another plugin's private internals.
- Each editor instance owns its state, selection, services, UI, tasks, and
  cleanup.
- Public APIs must be deliberate, typed, documented, and narrow. Avoid broad
  package-root exports that pull optional products into the default bundle.
- Use strict TypeScript. Avoid `any`, unchecked assertions, and weakened compiler
  settings.
- Do not add runtime dependencies unless the current CMS requirement cannot be
  met reasonably with existing code or platform APIs.

## 7. Lightweight distribution rules

The supported default entry must contain only the CMS WYSIWYG path.

- Source editing and other optional capabilities must use explicit entry points
  and lazy loading.
- The default entry must not import Markdown, comments, revisions, Preview,
  developer tools, React, Vue, or plugin scaffolding.
- CDN builds must provide a CMS-focused artifact; a historical all-features
  global is not the product performance reference.
- Do not raise a bundle or latency budget simply because a feature was added.
  First remove duplication, split optional code, or justify the regression with
  measured CMS value.
- Performance tests must cover startup, typing, selection, paste, tables,
  source toggling when enabled, repeated create/destroy, and large real HTML.

## 8. UI and behavior rules

- The default UI is a conventional CMS toolbar, editing area, optional element
  path/status, and focused dialogs/context tools.
- Every visible control must work, be keyboard reachable, localizable, and have
  a real command behind it.
- Prefer fewer clear controls over duplicated entry points.
- Dialogs must preserve selection, read current values, validate input, support
  cancel, return focus, and create one undo step.
- Context UI must not obstruct selection or ordinary cell/image/link editing.
- Mobile and narrow layouts may collapse or overflow controls without changing
  content semantics.
- Do not add fashionable interaction patterns unless they improve measured CMS
  tasks without making the classic path harder.

## 9. Compatibility and cleanup

Released public APIs require deliberate SemVer handling. Removing a feature from
the default preset does not require deleting its compatibility package in the
same change.

For every cleanup:

1. identify whether it is default, optional, internal, or public compatibility;
2. measure bundle/runtime effect;
3. remove default imports and UI first;
4. add migration or deprecation notes for public behavior;
5. delete code only when the compatibility policy permits it;
6. verify no CMS capability regressed.

Do not preserve accidental complexity merely because tests encode it. Rewrite
tests when the approved product contract has intentionally changed, but never
weaken valid HTML, security, lifecycle, or editing-correctness guarantees.

## 10. Documentation authority

Current product authority, in order, is:

1. `AGENTS.md`;
2. `docs/PRODUCT.md`;
3. `docs/ROADMAP.md`;
4. `docs/wysiwyg-editor.md`;
5. accepted ADRs not superseded by a later ADR.

Old prompts, migration guides, release histories, and feature-specific documents
describe historical behavior. They do not authorize new scope when they conflict
with the current authority above.

Keep important decisions under `docs/decisions/`. Do not silently reverse HTML
preservation, security, command, transaction, lifecycle, or framework-neutral
Core guarantees.

## 11. Working method

Before significant changes:

1. inspect `git status` and preserve unrelated user changes;
2. read the current authoritative documents;
3. inspect the actual default import graph, generated bundle, tests, and public
   compatibility surface;
4. define the CMS task being improved and its measurable acceptance criteria;
5. keep the change within that task.

After changes:

1. review the diff for accidental feature growth;
2. run focused tests;
3. run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` when relevant;
4. record bundle and interaction measurements for runtime changes;
5. report remaining browser, accessibility, performance, and compatibility
   limitations honestly.
