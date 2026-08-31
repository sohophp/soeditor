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
- `preserve`: retains more element/attribute structure but always removes
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
