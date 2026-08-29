# Public API policy

SoEditor supports imports only through declared package-root export maps. A
file being present in a tarball does not make it public; `src`, `dist` file
paths, concrete registries, DOM projection internals, and undocumented globals
are internal and may change without migration support.

## 0.7 classifications

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

## Structured extension boundary

A third-party structured widget can register a DOM-free conversion and a node
view, execute a command from that view, and use
`visualEditingServiceToken` to read or replace the selected immutable block.
It must not import engine internals, mutate live editor state, or render
preserved source children as executable DOM. The packed widget fixture in
`tests/consumers/widget` enforces this boundary under strict TypeScript, Vite,
Chromium, accessibility, security, and teardown checks.
