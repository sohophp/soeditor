# CMS roadmap baseline

## Purpose

This file records the local Phase 37 baseline before CMS Classic Editor feature
implementation. It is regression evidence, not a universal device or timing
claim. Measurements depend on the checked-in performance harness, current
toolchain, and local execution environment.

## Public boundary

- published baseline: `1.0.0`;
- current local CMS candidate: `1.1.0`;
- public packages: 23;
- generated API entries: 816 stable, 121 experimental, 0 deprecated;
- browser suite at baseline: 126 Chromium scenarios;
- runtime formats: HTML and Markdown;
- editing projections: Visual, Source, and Markdown; Preview remains readonly.

## Built artifact baseline

The Phase 37 type/build gate reported:

| Artifact                           |         Raw |      Gzip |
| ---------------------------------- | ----------: | --------: |
| complete browser global JavaScript | 1,331.57 kB | 425.65 kB |
| complete browser global CSS        |     8.79 kB |   1.94 kB |
| Core ESM                           |    32.25 kB |   7.03 kB |
| Engine ESM                         |   117.14 kB |  21.98 kB |
| Rich Text ESM                      |    61.54 kB |  12.49 kB |
| UI ESM                             |    37.79 kB |   7.99 kB |

The complete global intentionally contains optional developer families. The
future Classic entry must receive its own measured budget rather than inheriting
the global size as an acceptable target.

## Integration performance baseline

The deterministic Phase 37 performance gate reported:

| Guard                       | Measurement |
| --------------------------- | ----------: |
| canonical input             |     1.00 ms |
| projection updates          |     5.71 ms |
| annotation mapping          |    63.28 ms |
| table operations            |    35.62 ms |
| recovery                    |     2.87 ms |
| startup/teardown            |     1.44 ms |
| explicit-GC retained memory |    0.22 MiB |

Later phases must preserve the existing guards and add CMS-specific budgets for
classic startup, additional instances, external paste, uploads, large articles,
large media documents, and repeated classic mount/destroy.

## Known product gaps

The authoritative feature-level gaps and their owning milestones are tracked in
[`cms-capability-matrix.md`](cms-capability-matrix.md). In particular, 1.0 does
not provide one-call classic mounting, native form synchronization, Office paste
cleanup, host-owned uploads, localized chrome, or cross-engine browser
qualification.
