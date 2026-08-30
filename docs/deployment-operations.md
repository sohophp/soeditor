# Deployment and operations

This guide covers a production host integrating the SoEditor 1.0 candidate. It
does not authorize npm publication of the repository candidate.

## Build and pin

After an owner-authorized registry publication, install aligned package
versions and commit the lockfile:

```bash
pnpm add @soeditor/editor@1.0.0
pnpm install --frozen-lockfile
pnpm build
```

Use ESM for normal deployments and import the stylesheet explicitly. Do not mix
`@soeditor/*` minor versions. The direct-browser global is a larger compatibility
artifact and should be pinned to an exact version and integrity-controlled by
the host.

## Content Security Policy

A starting application policy might resemble the following, but the host must
adapt asset, image, font, API, and framing sources to its deployment:

```text
default-src 'self';
script-src 'self';
style-src 'self' 'nonce-{REQUEST_NONCE}';
img-src 'self' data: https://media.example;
connect-src 'self' https://api.example;
object-src 'none';
base-uri 'self';
frame-ancestors 'self';
```

Pass the same per-response nonce to CodeMirror-backed surfaces:

```ts
const source = createSourceEditingEngine({
    cspNonce: window.__REQUEST_CSP_NONCE__,
    editor,
    element: sourceHost,
});

const markdown = createMarkdownEditingEngine({
    cspNonce: window.__REQUEST_CSP_NONCE__,
    editor: markdownEditor,
    element: markdownHost,
});
```

Do not copy the example policy without reviewing application requirements. The
isolated Preview iframe adds its own fixed CSP; do not weaken its sandbox.

## Persistence and recovery

Listen to canonical `document:change`, debounce application saves, and include
your own document version or ETag. Handle conflicts in the backend or product
workflow; SoEditor does not silently merge concurrent documents.

Workspace recovery is optional and bounded. Observe `onDiagnostic`,
`onError`, and failed snapshots, preserve the latest owner value for controlled
editors, and provide a visible reload/export path after terminal failure. A
crash loop must not trigger unlimited recreation.

Comments and revisions use host adapters. Monitor adapter errors, serialize or
version writes, and implement authorization, audit, retention, backup, and
erasure server-side.

## Lifecycle

Create one editor/workspace per field. Destroy UI and projections in reverse
ownership order or let Workspace destroy returned attachment handles. On route,
tab, component, or CMS-field removal, await terminal destruction before
discarding the host. Do not retain editor services, DOM handles, or callbacks
after destruction.

The qualification gate repeats Core and browser lifecycles and checks explicit
GC memory retention. These are regression bounds, not proof that an application
cannot leak its own closures or framework state.

## Monitoring

Record application-level signals without serializing sensitive content unless
your privacy policy permits it:

- editor/workspace creation and destruction counts;
- Workspace diagnostic codes and terminal failures;
- save duration, failure, retry, and conflict counts;
- FileManager cancellation/validation failures;
- comment/revision adapter errors;
- document size and operation latency buckets;
- client error boundaries and unhandled rejections.

SoEditor does not send telemetry. The host decides whether and how monitoring is
collected, redacted, sampled, retained, and disclosed.

## Release rollout and rollback

Test a packed or registry artifact in staging with representative content and
host services. Roll out progressively when possible. Keep the previous build
deployable, but do not mix package versions inside one bundle. Because npm
versions are immutable, roll forward to a corrected patch rather than
overwriting a defective artifact.

Before changing SoEditor versions, review the complete migration chain and API
report. After deployment, smoke-test Visual, Source/Markdown, Preview, save,
readonly, FileManager, review adapters, and teardown using the production CSP.
