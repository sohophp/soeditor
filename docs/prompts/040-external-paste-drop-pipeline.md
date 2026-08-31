# Phase 40 — External Paste and Drop Pipeline

## Status

COMPLETE.

## Goal

Classify and normalize untrusted clipboard/drop input into deterministic CMS
HTML without weakening internal clipboard fidelity or loaded-source
preservation.

## Required implementation

1. Add an instance-scoped plugin-owned paste pipeline with ordered processors,
   observable rejection, bounded input/output, and terminal cleanup.
2. Distinguish internal SoEditor, cross-editor, web, plain-text, Office,
   Google Docs, LibreOffice, and file-bearing inputs.
3. Provide preserve, semantic, and plain-text policies; every external HTML
   policy strips executable elements, event handlers, and unsafe URLs.
4. Normalize representative headings, marks, links, lists, and tables in one
   transaction while retaining internal semantic clipboard fidelity.
5. Route both paste and external drop through the same pipeline; leave file
   task handling to Phase 41.
6. Add fixed fixtures, unit/browser security evidence, history evidence, and
   explicit loss documentation.

## Explicitly deferred

- pixel-identical Office layout, formulas, macros, arbitrary CSS, OCR, and
  upload processing;
- changing the separate policy for HTML already loaded from a CMS.

## Definition of Done

- fixture output is deterministic and losses are documented;
- rejection is observable and never partially changes the document;
- internal clipboard fidelity is unchanged;
- all repository gates pass with Critical = 0 and High = 0.

## Delivered

- Instance-scoped ordered processors classify internal, incompatible,
  file-bearing, Office, Google Docs, LibreOffice, web, and plain-text input.
- The CMS processor implements preserve, semantic, and plain-text policies,
  bounded style retention, semantic whitespace normalization, and executable
  content removal without changing loaded-source preservation.
- Paste and external drop share one transaction boundary; internal custom MIME
  retains semantic fidelity, while failures emit observable diagnostics and do
  not mutate canonical HTML.
- Fixed multi-source fixtures plus unit and Chromium scenarios cover
  deterministic output, security, history, file deferral, and cleanup. All 132
  Chromium scenarios pass.
