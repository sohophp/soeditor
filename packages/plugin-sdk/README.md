# @soeditor/plugin-sdk

Narrow package-root facade for SoEditor plugin authors. It re-exports public
SoEditor-owned lifecycle, command, service, diagnostics, projection/layout, UI
contribution, and FileManager contracts without exposing implementation
registries or third-party library types.

The SDK includes generic diagnostics workflow types and the adapter/service
contracts needed by alternate split-view integrations. Built-in accessibility
and SEO rule configuration remains owned by `@soeditor/html-tools`; the built-in
DOM layout factory remains owned by `@soeditor/layout`.
