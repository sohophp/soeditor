# Phase 41 — Upload and Asset Workflow

## Status

COMPLETE.

## Goal

Add host-owned asynchronous uploads to the replaceable asset-selection
boundary and complete the image authoring workflow without adding a server or
storage dependency.

## Required implementation

1. Define typed per-editor UploadService and task contracts with progress,
   cancellation, validation, retry, concurrent-task, and terminal semantics.
2. Route file input, drop, clipboard, replacement, and Office-image inputs
   through the same upload boundary while retaining the FileManager picker.
3. Project temporary image previews without serializing Blob URLs into
   canonical HTML; revoke every owned URL on success, failure, cancellation,
   replacement, and destruction.
4. Validate uploaded assets before a single transactional insert or
   replacement and reject unsafe URLs or malformed dimensions observably.
5. Add command-driven image properties for alt, title, dimensions, aspect,
   caption, alignment, responsive class, link, replace, and remove.
6. Provide unit, packed-adapter, and real-browser evidence for success,
   progress, concurrent work, failure/retry, cancel, unsafe results, readonly,
   and teardown.

## Explicitly deferred

- built-in HTTP endpoints, authentication, authorization, storage, DAM,
  optimization, or a SoFinder hard dependency;
- arbitrary executable media or server-specific multipart conventions.

## Definition of Done

- temporary state never leaks into canonical HTML or survives teardown;
- upload results and image properties remain command/transaction controlled;
- all repository gates pass with Critical = 0 and High = 0.

## Delivered

- A host-owned `UploadService` returns cancellable, progress-reporting tasks;
  the per-editor workflow provides bounded concurrency, size/MIME validation,
  retry records, terminal behavior, and observable immutable snapshots.
- File input, paste, and drop share the pipeline consumption boundary. Existing
  asset selection remains independently replaceable through `FileManager`.
- Blob previews never enter canonical HTML and are revoked on success, failure,
  cancellation, retry, and destruction. Validated results insert or replace
  through media commands.
- Structured images now support title, dimensions, aspect lock, caption,
  alignment, responsive classes, safe links, replacement, and removal.
- Unit, packed NodeNext adapter, and 133 Chromium scenarios pass, including
  progress, success, retry, cancel, paste/drop, unsafe results, and cleanup.
