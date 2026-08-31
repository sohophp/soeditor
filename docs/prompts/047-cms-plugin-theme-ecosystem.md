# Phase 47 — CMS Plugin and Theme Ecosystem

## Status

COMPLETE.

## Goal

Make CMS-specific extension and theming surfaces documented, testable, and
distributable without remote execution, private coupling, or a hosted
marketplace.

## Required implementation

1. Inventory all current public/experimental CMS extension boundaries,
   plugin-tools templates, SDK exports, UI variables, icon rendering, content
   styles, package checks, and packed third-party fixtures.
2. Qualify public contributions for semantic styles, context menus,
   contextual UI, paste processors, upload adapters, content pickers,
   translations, and atomic CMS objects using only documented package roots.
3. Extend versioned plugin scaffolding/checks with focused CMS widget, paste,
   upload, and theme templates or selectable contribution families while
   preserving offline deterministic generation.
4. Add host-scoped theme variables, supported icon replacement, explicit
   content-style separation, high-contrast behavior, and host-isolation
   examples without adding a UI framework or global theme registry.
5. Ensure third-party contributions own cleanup, reject duplicate IDs and
   unsafe output, preserve unknown source, and never execute remote code.
6. Add generated and hand-authored packed consumers for CMS widget, paste,
   upload, translations, and theme/icon customization.
7. Document extension compatibility, versioning, security, package layout,
   accessibility responsibilities, and the boundary between editor chrome and
   saved content.
8. Run focused unit/browser/adversarial checks and every repository, release,
   packed-consumer, license, and security gate.

## Architectural boundaries

- Extensions depend only on documented public roots, commands, transactions,
  services, events, and contribution registries.
- Themes and icons affect host-scoped chrome; content styles are explicit
  application data and never silently serialized by UI customization.
- No remote plugin loading, marketplace, arbitrary script execution, trust
  certification, framework dependency, or global mutable contribution/theme
  registry is introduced.
- Core remains unaware of CMS feature implementations, browser DOM, themes,
  icons, and plugin tooling.

## Definition of Done

- generated and hand-authored third-party fixtures use only documented public
  roots and survive typecheck, build, pack, runtime, accessibility, security,
  and teardown checks;
- contribution families are independently replaceable, instance scoped, and
  cleanup safe;
- strict type, unit, performance, API, docs, packed consumer, distribution,
  release, browser, license, and security gates pass;
- adversarial review reports Critical = 0 and High = 0.

## Completion evidence

- The curated SDK exposes CMS style, contextual UI, paste, upload,
  content-picker, translation, and atomic-object contracts through package
  roots only.
- Plugin template version 3 generates `basic`, `cms-widget`, `paste`, `upload`,
  and `theme` families; every family builds and passes a script-disabled packed
  check.
- The checker reports duplicate/invalid IDs, internal and remote imports,
  dynamic evaluation, and direct DOM HTML injection sinks without importing
  source.
- Classic/UI accept bounded per-instance plain-text icons and host-scoped theme
  variables, preserve accessible labels and canonical content, isolate sibling
  instances, and restore caller inline values on destroy.
- Strict lint/type/unit/performance/API/docs/consumer/distribution/release,
  144-scenario Chromium, four-run desktop/mobile CMS, license, and dependency
  gates pass. The measured global is 1,431.67 kB raw / 454.94 kB gzip with
  11.64 kB CSS. Adversarial review: Critical 0, High 0.
