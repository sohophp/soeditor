# Phase 45 — Localization, IME, Mobile, and Accessibility

## Status

COMPLETE.

## Goal

Qualify the CMS Classic Editor for multilingual daily authoring, with Chinese
composition, RTL infrastructure, mobile interaction, and complete keyboard
operation treated as product gates.

## Required implementation

1. Inventory every default toolbar, dialog, menu, notification, status,
   command, node-view, and accessibility-help string before defining locale
   ownership.
2. Add per-editor, lazy-capable translation resources with complete English,
   Simplified Chinese, and Traditional Chinese baselines plus deterministic
   locale fallback and isolation.
3. Apply translations to classic chrome and accessibility names without
   introducing a mutable global locale or coupling Core to browser language.
4. Harden composition input and one-step history across representative
   Simplified/Traditional Chinese, punctuation, selection replacement,
   cancellation, and browser event-order variants.
5. Add logical-direction RTL infrastructure and verify toolbar, dialogs,
   menus, status, tables, media, and Source layout without rewriting content
   direction.
6. Qualify narrow/touch interaction, virtual-keyboard viewport changes,
   selection, dialogs, context menus, toolbar collapse, and return-to-editing
   focus.
7. Provide embedded keyboard/accessibility help and test all classic controls,
   content objects, element path, and focus return with assistive semantics.
8. Add Chromium, Firefox, and WebKit automation where installed, document
   environment-limited manual IME/screen-reader checks, and run every existing
   repository/release gate.

## Architectural boundaries

- Locale and direction are per editor; Core remains language and DOM neutral.
- Translation resources are data and resolvers, never HTML injection.
- Composition remains controlled transaction input with shared Core history;
  projected DOM never becomes authoritative.
- Mobile/RTL layout uses logical CSS and instance-owned listeners only.
- No claim of universal locale, WCAG, screen-reader, or native IME
  certification.

## Definition of Done

- English, Simplified Chinese, and Traditional Chinese resources are complete
  for the qualified classic surface and isolated across simultaneous editors;
- automated CJK composition/history, RTL, narrow/touch, keyboard, focus, and
  multi-browser evidence passes where the environment permits;
- remaining manual IME and assistive-technology checks are explicit;
- all repository gates pass with Critical = 0 and High = 0.

## Delivered

- per-instance, validated English, Simplified Chinese, Traditional Chinese,
  custom locale, deterministic fallback, and logical direction resources with
  no mutable global locale;
- localized classic chrome, dynamic accessibility names, status text, context
  menus, and an embedded keyboard/accessibility help dialog;
- distinct composition-session history groups that keep sequential Chinese
  input atomic through selection replacement and undo;
- responsive 44px touch targets, isolated RTL chrome, virtual viewport and
  pointer-resize evidence, keyboard focus return, and automated axe checks;
- a reusable Chromium/Firefox/WebKit/mobile Playwright configuration, with
  Firefox and WebKit launch limitations documented for the current host;
- 142 passing Chromium scenarios plus four desktop/mobile CMS project runs,
  complete strict/release/supply-chain gates, and a measured 1,422.93 kB raw /
  452.51 kB gzip global with 11.34 kB standalone CSS.
