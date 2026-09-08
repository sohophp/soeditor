---
title: 'Changelog'
description: 'Changes in SoEditor 1.2.1 and the published documentation baseline.'
---

# Changelog

## Documentation update

Added bilingual React, Vue and video guides and examples. Video uses published 1.2.1 with a same-origin sample and downloadable source. Framework CMS components are unreleased and explicitly documented as local previews. This documentation update is not a new npm release.

## 1.2.1

Fixes the published 1.2.0 `/cms` ESM initialization hang caused by unsafe property minification. Shared object keys now remain consistent between chunks. Public APIs are unchanged. The site pins 1.2.1 and ordinary demos use `/cms`; Source, save and asset-plugin demos use `/cms/optional`.

A browser regression imports the built CMS artifact and verifies initial HTML, CMS attributes, comments, tables, replacement and destruction.

## 1.2.0

Added explicitly optional video, article preview, toolbar drawers, and selection, table and image editing fixes. Its `/cms` ESM artifact has the initialization defect fixed in 1.2.1; upgrade before using that entry.

[Migration guide](/en/support/migration) · [npm release](https://www.npmjs.com/package/@soeditor/editor/v/1.2.1).
