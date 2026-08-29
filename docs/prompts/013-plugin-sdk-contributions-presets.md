# Phase 13 Implementation Specification — Plugin SDK, Contributions, Presets

## Status

Active implementation specification for Phase 13 of `docs/ROADMAP.md`.

## Goal

Make the extension points already proven by Phases 1–12 practical for an
independently packaged plugin, and provide coherent plugin/toolbar presets
without moving feature behavior into Core.

## Public extension surface

Provide `@soeditor/plugin-sdk` as a deliberately narrow convenience package for
plugin authors. It may re-export stable SoEditor-owned plugin, command, event,
service, UI contribution, diagnostics, and FileManager contracts from their
owning packages. It must not expose concrete registries, editing-model
internals, CodeMirror, parse5, Prettier, micromark, or private subpaths.

Existing imperative lifecycle registration remains authoritative. Do not add a
second plugin runtime or speculative manifest language. Registration APIs must
return or document cleanup ownership where applicable, reject duplicate
contributions, and remain terminal after editor destruction.

Add a small generic status-item contribution only if it can use the existing UI
registry and editor-owned cleanup. Toolbar items and shortcuts already satisfy
their contribution needs; diagnostic providers already use a typed registry.
Defer menu and formatter registries until more than one concrete implementation
requires them.

## Presets

Provide `@soeditor/presets` with immutable `minimal`, `classic`, `developer`,
and `markdown` preset definitions. A preset declares document format, plugin
constructors, and toolbar configuration; it does not create DOM surfaces,
FileManager implementations, Preview policy, or application state. Consumers
remain responsible for attaching the compatible Visual, Source, Markdown, UI,
and Preview surfaces.

Preset arrays and objects must be frozen, free from duplicate plugin IDs, and
composable through a typed helper that validates additions without mutating the
base preset.

## External plugin proof

Create a consumer fixture implementing a meaningful word-count/status feature
using package-root APIs only. Cover lifecycle cleanup, duplicate IDs,
independent editor instances, readonly behavior where relevant, package
declarations, NodeNext/ESM consumption, and a real Chromium preset workflow.

Document plugin anatomy, compatibility rules, cleanup, commands, services,
contributions, diagnostics, and preset composition.

## Explicitly deferred

Do not build plugin discovery/install, remote code loading, a plugin
marketplace, CLI scaffolding, dynamic hot reload, arbitrary declarative
manifests, a menu registry without a current consumer, or framework adapters.

## Definition of Done

- An external package can add a meaningful feature without internal imports.
- Four immutable presets compose only public plugin constructors.
- Critical = 0 and High = 0.
- lint, typecheck, tests, build, packed consumers, and Chromium pass.
