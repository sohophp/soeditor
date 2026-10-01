# CMS paste and drop policy

The CMS preset routes external clipboard and drop HTML through an
instance-scoped `PastePipelinePlugin` and `CmsPastePlugin`. This policy applies
only to new external input. It does not sanitize or rewrite HTML loaded from a
CMS, and it does not change the inert rendering boundary for preserved source.

## Configuration

```ts
await createClassicEditor(textarea, {
    config: {
        cms: {
            paste: {
                policy: 'semantic',
                officePolicy: 'semantic',
                webPolicy: 'inherit',
                retainStyles: false,
                retainAlignment: false,
                maxInputCharacters: 1_000_000,
                maxOutputCharacters: 1_000_000,
            },
        },
    },
});
```

Policies are:

- `semantic` (default): retains headings, semantic marks, safe links, lists,
  bounded tables, and safe images; removes source-specific presentation.
- `preserve`: keeps original fragment source, tags, comments, whitespace,
  attribute spelling, classes, and safe CSS declarations; always removes
  executable elements, event handlers, unsafe URLs, and unsafe CSS.
- `plain-text`: ignores HTML and inserts normalized text paragraphs.

`officePolicy` independently controls Word, Excel, Google Docs, and
LibreOffice input. `webPolicy` controls ordinary web and cross-editor HTML.
Either may be `inherit` to use `policy`. This makes automatic cleanup explicit
per source; a host that wants an interactive choice can select a policy before
creating the editor or provide its own higher-priority paste processor.

`retainStyles` adds a bounded allowlist for color, background color, font
family, font size, font weight/style, text alignment, and text decoration.
URLs and CSS functions remain subject to the security filter.

For CKEditor 4-like external web cleanup, use `policy: 'semantic'`,
`retainStyles: false`, and `retainAlignment: false`. This removes inline styles
and classes while retaining supported content structure. `retainAlignment`
defaults to `true` for compatibility and only controls semantic cleanup when
style retention is disabled; it does not affect the `preserve` policy.
HTML pasted as text into Source bypasses external visual paste cleanup. Hosts
that require literal source must also disable `source.autoFormat`; explicit
Format and Minify actions remain available.

Default semantic cleanup omits the neutral `text-align: start` materialized by
native web clipboards. It retains explicit center/right/left/justify alignment
and a child's `start` when it overrides an aligned ancestor. The `preserve`
policy keeps authored alignment values, including `start` and table-cell `left`,
without synthesizing defaults. Browser-generated clipboard styles cannot be
distinguished reliably from authored inline styles; preservation therefore
keeps the received HTML instead of guessing and deleting declarations. Existing CMS
content is never scanned or rewritten for this cleanup. Nested text inside
`pre` and `code` retains its literal whitespace.

Unchanged top-level visual blocks retain their original source when another
block is edited. Editing a block can require HTML serialization of that block;
inserting inline HTML inside an existing block also uses its DOM serialization.
This can normalize quotes, entities, or implicit HTML table containers, but does
not apply semantic paste cleanup or add computed alignment styles.

## Classification and losses

The pipeline distinguishes internal SoEditor, incompatible/cross-editor,
Office, Google Docs, LibreOffice, web, plain-text, and file-bearing input.
Internal data uses a versioned custom MIME payload and retains the semantic
model HTML. File input is rejected observably until an application supplies
the Phase 41 upload boundary.

Expected semantic-policy losses include page layout, Office-only namespaces,
conditional comments, document metadata, spreadsheet formulas, macros,
arbitrary classes, arbitrary CSS, and unknown presentation wrappers. Text and
supported heading, mark, link, list, and table semantics are retained where
the input can be represented safely.

Every accepted paste/drop becomes one document transaction and therefore one
undo step. Size or processor failure emits a `PasteDiagnostic` through the
per-editor service and leaves canonical source unchanged. Classic Editor turns
that diagnostic into an accessible error notification; table paste also warns
when the clipboard has no insertable content, so rejected input is never a
silent no-op. No pipeline path injects source HTML into the live editor DOM.
