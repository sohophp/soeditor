# Public API policy

SoEditor supports imports only through declared package-root export maps. A
file being present in a tarball does not make it public; `src`, `dist` file
paths, concrete registries, DOM projection internals, and undocumented globals
are internal and may change without migration support.

## 0.8 classifications

| Classification          | Surface                                                                                                                                                                                                                                             | Compatibility expectation                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Application public      | `@soeditor/editor`, preset entries, documented feature package roots, configuration and lifecycle APIs                                                                                                                                              | Deliberate SemVer changes with migration notes                                        |
| Extension-author public | Curated exports from `@soeditor/plugin-sdk`: plugin lifecycle, commands/events/services, UI/diagnostic/projection/layout/FileManager contributions, structured conversions/node views, immutable editing operations, and the visual editing service | Deliberate SemVer changes; packed external consumers are a release gate               |
| Experimental public     | Structured block/node-view model, selection and mutation contracts, table/media command breadth                                                                                                                                                     | Available from documented roots, but may evolve during 0.x with an explicit migration |
| Internal                | Concrete registry implementations, renderer/projection classes, parser/editor implementation types, private symbols, and all undeclared subpaths                                                                                                    | No compatibility promise                                                              |

The SDK is a curated facade over owning packages, not a second runtime and not
an export of every built-in feature. Third-party plugins declare aligned
`@soeditor/*` peer dependencies and import built-in plugins from their owning
package. Generic contracts required by an extension belong in the SDK; feature
configuration and concrete implementations remain with their owner.

Phase 27 adds experimental visual-decoration contracts to the engine and SDK.
Phase 29 makes `@soeditor/comments` public. Its immutable models, plugin
factory, service token, storage/permission contracts, mapped ranges, versioned
export, tombstone deletion, and permanent erasure are application public.

Phase 28 adds the general application-level `Editor.setReadonly()` transition;
attached editor surfaces must honor it dynamically. Phase 29 makes the
revision provider/storage, comparison, review-policy, plugin, service,
versioned export, and optional erasure contracts in `@soeditor/revisions`
application public. Both review families are curated through the 0.8 SDK and
umbrella package.

Concrete comment/revision controllers, panel renderers, mapping internals, and
undeclared subpaths remain internal. Review exports are bounded client views,
not authoritative regulatory exports; data ownership and backend deletion
remain host responsibilities.

Phase 30's `@soeditor/workspace` package remains private while lifecycle,
controlled-value, and recovery contracts are validated. It is intentionally
absent from the 0.8 SDK and umbrella exports; public classification is deferred
to the Phase 33 0.9 release gate.

Phase 31's `@soeditor/react` and `@soeditor/vue` packages are likewise private
validation surfaces. They are not 0.8 SDK or umbrella exports, and their React
or Vue peers do not become dependencies of any existing public package.

Phase 32's `@soeditor/plugin-tools` and new Workspace diagnostic contracts are
private until the Phase 33 0.9 release audit. The checker does not define plugin
runtime compatibility by itself; public SDK types and behavioral consumers
remain authoritative.

## Structured extension boundary

A third-party structured widget can register a DOM-free conversion and a node
view, execute a command from that view, and use
`visualEditingServiceToken` to read or replace the selected immutable block.
It must not import engine internals, mutate live editor state, or render
preserved source children as executable DOM. The packed widget fixture in
`tests/consumers/widget` enforces this boundary under strict TypeScript, Vite,
Chromium, accessibility, security, and teardown checks.
