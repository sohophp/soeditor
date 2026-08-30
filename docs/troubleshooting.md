# Troubleshooting

Start with the first thrown SoEditor error or Workspace diagnostic. Errors are
designed to be actionable; do not suppress them and continue with a partially
attached editor.

## Installation and imports

### Package subpath is not exported

Import only documented package roots and declared preset/CSS subpaths. Paths
such as `@soeditor/engine/model`, `src/*`, or private `dist/*` files are
internal. Use the generated [`api-report.md`](api-report.md) to confirm the
public symbol owner.

### Duplicate framework or peer warnings

Install one aligned SoEditor version set. React must satisfy `>=18.2.0 <20` and
Vue must satisfy `^3.5.0`. Framework packages are separate from
`@soeditor/editor`; install only the adapter used by the application.

### Styles are missing

Import `@soeditor/editor/styles.css` for the umbrella UI, or the owning package
styles such as `@soeditor/ui/styles.css` and
`@soeditor/layout/styles.css` for modular integrations.

## Startup and attachment

| Error or diagnostic                        | Meaning and action                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `PluginNotFoundError`                      | Add the declared plugin dependency to the editor plugin list.             |
| `PluginDependencyCycleError`               | Remove the cycle; plugin requirements must form a DAG.                    |
| `PluginDuplicateIdError`                   | Keep one plugin constructor for each stable ID.                           |
| `ServiceNotFoundError` / `missing-service` | Register the required per-editor service before attachment.               |
| `incompatible-format`                      | Attach HTML surfaces only to HTML and Markdown surfaces only to Markdown. |
| `unsafe-preview`                           | Use the isolated Preview policy for untrusted content.                    |
| host-not-empty errors                      | Give a surface an empty, application-owned host.                          |
| already-attached errors                    | Destroy the prior surface or use a different host/editor.                 |

On partial Workspace startup failure, inspect diagnostics and the original
cause. Successfully created earlier attachments are destroyed in reverse order;
do not reuse their retained handles.

## Editing behavior

### A command is unavailable

Check `editor.commands.has(id)` and `canExecute(id)`, document format, mode,
readonly/review policy, current selection, required service, and projection
ownership. UI buttons invoke the same command and do not bypass these rules.

### Visual is locked but Source still contains data

Parser-invalid or complete-document HTML may be Source-owned while Visual keeps
the last valid model. Correct the source diagnostics rather than copying the
Visual DOM back into the editor.

### Unknown HTML appears as an opaque block

This is preservation, not deletion. Add a structured conversion/node view only
when the element needs a richer visual experience. Keep execution and source
preservation separate.

### HTML/Markdown conversion changed content

The bridge is intentionally lossy. Inspect returned conversion loss notices;
keep Markdown canonical in Markdown workflows and use raw HTML passthrough only
with an isolated Preview boundary.

## Preview, CSP, and assets

Preview scripts do not run by design. If the iframe is blank, inspect template
validation, URL policy, renderer format, and browser console. Do not add sandbox
permissions to make an executable site preview.

If Source or Markdown styling is blocked by CSP, supply the current response
nonce as `cspNonce` when creating the CodeMirror engine and verify the nonce is
allowed by `style-src`. FileManager results must use accepted URL schemes and
valid metadata; cancellation intentionally leaves the document unchanged.

## Recovery and persistence

Workspace recovery is in-memory and rate-limited. A `recovery-limit` terminal
diagnostic requires application action: preserve/export current source, stop
automatic restart, report the failure, and let the user reload deliberately.

For comment/revision failures, inspect service snapshots or `lastError`, retry
according to host policy, and reconcile against authoritative backend versions.
Client-side permissions never replace server authorization.

## Minimal diagnostic capture

When reporting a reproducible issue, include SoEditor package versions, Node and
browser/framework versions, document format/mode/readonly policy, relevant
plugin IDs, exact error name/message, Workspace diagnostic code, smallest safe
source sample, reproduction steps, and whether teardown completed. Remove
credentials, personal data, unpublished content, and authentication headers.
