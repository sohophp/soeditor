# @soeditor/plugin-sdk

Narrow package-root facade for SoEditor plugin authors. It re-exports public
SoEditor-owned lifecycle, command, service, structured-editing,
diagnostics, projection/layout, UI contribution, and FileManager contracts
without exposing implementation registries or third-party library types.

The SDK includes generic diagnostics workflow types and the adapter/service
contracts needed by alternate split-view integrations. Built-in accessibility
and SEO rule configuration remains owned by `@soeditor/html-tools`; the built-in
DOM layout factory remains owned by `@soeditor/layout`.

Structured block conversion contracts, the editor-owned registry token, and
operation/position mapping are re-exported from their `@soeditor/engine` owner.
Conversion callbacks use only SoEditor HTML values and cannot create editing
DOM; see the repository plugin guide for a complete custom-element example.
The experimental visual-decoration plugin, token, and immutable range types are
also exposed for non-canonical annotation providers.
