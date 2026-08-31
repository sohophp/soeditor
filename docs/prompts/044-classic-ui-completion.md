# Phase 44 — Classic UI Completion

## Status

COMPLETE.

## Goal

Complete a responsive, accessible classic editor chrome for daily CMS content
production without moving content mutation or application layout ownership
into the UI package.

## Required implementation

1. Inventory the existing UI registry, toolbar, overlays, classic wrapper,
   sizing, status contributions, themes, focus handling, and teardown behavior.
2. Add accessible icon-capable toolbar controls with labels/tooltips, grouped
   keyboard navigation, responsive wrapping/overflow, collapse, and sticky
   policies that remain instance scoped.
3. Add registered contextual link, image, and table UI plus an extensible
   context-menu contribution boundary; every content action must execute an
   existing command.
4. Add maximize, manual resize, bounded auto-grow, and narrow-layout behavior
   with deterministic restoration of caller-owned hosts and document state.
5. Provide default classic status contributions for element path, word and
   character counts, dirty/save state, and accessible asynchronous
   notifications.
6. Keep chrome theming behind host-scoped CSS variables and prevent editor UI
   styles from leaking into caller content or unrelated instances.
7. Add focused unit tests, desktop/narrow/zoom/forced-colors browser journeys,
   public API classification and packed-consumer coverage, documentation, and
   measured release evidence.

## Architectural boundaries

- UI invokes commands and reads public services/state; it never directly
  mutates canonical HTML or becomes the authoritative editing model.
- Core remains DOM and framework independent, and each editor owns its UI,
  overlays, listeners, layout state, and cleanup.
- Context menus and contextual UI are registered contributions, not private
  feature coupling.
- No arbitrary docking, framework-owned application shell, page builder, or
  global mutable toolbar/theme registry.

## Definition of Done

- desktop, narrow viewport, zoom, forced-colors, keyboard, focus, and repeated
  lifecycle scenarios pass;
- responsive policies do not hide the only accessible route to a command;
- maximize/resize/auto-grow and destruction restore exact caller-owned state;
- strict type, unit, performance, API, docs, packed consumer, distribution,
  release, browser, license, and security gates pass;
- adversarial review reports Critical = 0 and High = 0.

## Delivered

- configurable wrap/scroll, sticky, collapsible toolbar layout with roving
  Arrow/Home/End focus and retained accessible names/tooltips;
- instance-scoped command-backed context-menu contributions used by classic
  link, media, and table actions through pointer and Shift+F10 paths;
- bounded pointer/keyboard height resizing, auto-grow handoff, explicit
  maximize/restore, and coordinated exact document-overflow cleanup;
- default classic mode/dirty state, selected element path, Unicode character
  and word counts, plus existing accessible asynchronous notifications;
- host-scoped responsive/theme CSS and desktop, narrow, 150% zoom,
  forced-colors, keyboard, focus, and lifecycle browser evidence;
- public API classification and packed NodeNext consumer coverage, 139 passing
  Chromium scenarios, and a measured 1,412.35 kB raw / 448.72 kB gzip global
  with 11.14 kB standalone CSS;
- full strict type, unit, performance, API, docs, consumer, distribution,
  release, license, and security gates with Critical 0 and High 0.
