---
title: 'Changelog'
description: 'Changes in SoEditor 1.5.0 and the published documentation baseline.'
---

# Changelog

## 1.5.0 — 2026-10-07

- Add opt-in rich paste choices: keep formatting, clean formatting or text only. Automatic paste remains the default; cancellation leaves content unchanged.
- Report Source formatting/minification errors with reasons, positions and codes while preserving source and undo history.
- Improve link search/settings, image properties/previews, CMS disclosure lifecycle and safe element unwrapping. Preserve authored HTML, table alignment and literal code whitespace.
- Load global translations, link/block tools, paste dialogs and detailed dialog styles on demand. Self-host the complete dist directory.
- Align bilingual guides, React/Vue examples and the downloadable project with published 1.5.0 packages. No new editor runtime dependencies or stable API removals.

## 1.4.0

Video tools are enabled by default with lazy dialogs and players; use `video: false` to opt out. Fixes paragraph tool positioning after image resizing. React, Vue, video and SoFinder examples now use npm 1.4.0. Self-hosted global scripts require the complete dist directory.

## 1.3.0

Adds React and Vue CMS component entries with HTML binding, form submit/reset, SSR and asynchronous lifecycle handling. Fixes native input loss during React event capture. The site now uses npm 1.3.0 for React, Vue and video examples and recommends SoFinder as its best asset management companion.

## 1.2.1

Fixed the property minification issue that could hang initialization of the 1.2.0 default CMS ESM entry.
