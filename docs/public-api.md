# Public API policy

SoEditor supports imports only through declared package-root export maps. A
file being present in a tarball does not make it public; `src`, `dist` file
paths, concrete registries, DOM projection internals, and undocumented globals
are internal and may change without migration support.

## 1.0 classifications

The generated [`api-report.md`](api-report.md) inventories every exported
symbol and declaration signature. [`support-policy.md`](support-policy.md)
defines the exact SemVer, deprecation, runtime, security, and maintenance
contract. The classifications below explain the architectural groups; the
generated report is the symbol-level review gate.

| Classification          | Surface                                                                                                                                                                                                                                             | Compatibility expectation                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Application public      | `@soeditor/editor`, preset entries, documented feature package roots, configuration and lifecycle APIs                                                                                                                                              | Stable entries receive the 1.x SemVer policy                                         |
| Extension-author public | Curated exports from `@soeditor/plugin-sdk`: plugin lifecycle, commands/events/services, UI/diagnostic/projection/layout/FileManager contributions, structured conversions/node views, immutable editing operations, and the visual editing service | Stable entries receive the 1.x SemVer policy; packed consumers remain a release gate |
| Experimental public     | Structured block/node-view model, selection and mutation contracts, visual decorations, table/media extension breadth                                                                                                                               | May evolve in 1.x minors only with changelog and migration guidance                  |
| Internal                | Concrete registry implementations, renderer/projection classes, parser/editor implementation types, private symbols, and all undeclared subpaths                                                                                                    | No compatibility promise                                                             |

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
application public. Both review families are curated through the aligned SDK and
umbrella package.

Concrete comment/revision controllers, panel renderers, mapping internals, and
undeclared subpaths remain internal. Review exports are bounded client views,
not authoritative regulatory exports; data ownership and backend deletion
remain host responsibilities.

SoEditor 0.9 makes `@soeditor/workspace` application public and exports it from
the framework-neutral umbrella. Its lifecycle, controlled/uncontrolled value,
bounded recovery, attachment requirement, and diagnostic contracts receive
0.x SemVer treatment; DOM hosts, persistence, error interception, and security
policy remain application-owned.

`@soeditor/react` and `@soeditor/vue` are public framework adapters with React
or Vue peers only in their owning packages. They are deliberately absent from
the umbrella. `@soeditor/plugin-tools` is a public Node-only CLI/API package and
is also absent from the browser umbrella. Its checker does not define runtime
compatibility by itself; public SDK types and behavioral consumers remain
authoritative.

There are currently no deprecated package-root exports. Undeclared subpaths
remain internal and are intentionally rejected by packed NodeNext consumers.

## Structured extension boundary

A third-party structured widget can register a DOM-free conversion and a node
view, execute a command from that view, and use
`visualEditingServiceToken` to read or replace the selected immutable block.
It must not import engine internals, mutate live editor state, or render
preserved source children as executable DOM. The packed widget fixture in
`tests/consumers/widget` enforces this boundary under strict TypeScript, Vite,
Chromium, accessibility, security, and teardown checks.
