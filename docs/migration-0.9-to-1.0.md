# Migrating from SoEditor 0.9 to 1.0

This guide describes the frozen 1.0 candidate contract. Use the final aligned
`1.0.x` versions only after an owner-authorized release exists; the repository
currently contains the aligned local `1.0.0` candidate.

## Compatibility outcome

Representative 0.9 NodeNext, native ESM, Vite, CMS, plugin, React, Vue, and
browser integrations compile and run unchanged against the frozen stable API.
No stable 0.9 package-root symbol requires a source migration for the 1.0
candidate.

Phase 34 adds a generated API report and classifies each export. Stable entries
receive the documented 1.x SemVer policy after release. Structured editing
models/operations, conversion/node-view contracts, visual decorations, and
table/media extension breadth remain experimental and may evolve in a 1.x
minor with migration notes.

## Package update

When 1.0 is authorized and published, update all directly installed
`@soeditor/*` packages together:

```json
{
    "dependencies": {
        "@soeditor/editor": "1.0.0",
        "@soeditor/react": "1.0.0",
        "@soeditor/workspace": "1.0.0"
    }
}
```

Do not mix 0.9 and 1.0 packages. Keep React in `>=18.2.0 <20`, Vue in `^3.5.0`,
and use the supported Node line recorded in package manifests and
[`support-policy.md`](support-policy.md).

## CSP-capable Source and Markdown

The candidate adds an optional `cspNonce` to Source and Markdown engine options.
Existing integrations need no change. Applications with nonce-based
`style-src` should pass the per-response nonce:

```ts
createSourceEditingEngine({ cspNonce, editor, element: sourceHost });
createMarkdownEditingEngine({
    cspNonce,
    editor: markdownEditor,
    element: markdownHost,
});
```

Empty nonces are rejected. Preview sandbox/CSP behavior remains unchanged.

## Theme and accessibility behavior

Dark UI colors are scoped to SoEditor-owned chrome rather than leaking through
an application host. Primary dark-theme actions use a contrasting foreground,
and split focus remains visible in forced-colors mode. Applications relying on
accidental inherited host text color must style their own container explicitly.

## Checklist

1. Replace internal/subpath imports with entries in `docs/api-report.md`.
2. Align package versions and satisfy framework peers.
3. Run strict TypeScript and the production bundler.
4. Exercise save/recovery, readonly/review, FileManager, Preview, and teardown.
5. Test the production CSP and pass a CodeMirror nonce where required.
6. Review experimental imports and pin behavior with application tests.
7. Read the security, deployment/operations, troubleshooting, and support
   policies before rollout.

The 1.0 candidate does not add real-time collaboration, track changes, remote
plugins, executable Preview, arbitrary HTML execution, byte-perfect
preservation, or lossless HTML/Markdown conversion.
