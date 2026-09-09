# SoEditor development status

## Current worktree — 2026-09-08

The `1.4.0` release is owner-authorized on 2026-09-09 and all 24 manifests are aligned. Publication and public verification are tracked by the protected npm workflow; local builds are not a registry publication claim.

Default video and the image tool fix are documented in [1.4.0](releases/1.4.0.md).

The active follow-up is [CMS correctness and article baselines](cms-followup-2026-09-08.zh-CN.md). That page is the single current acceptance summary for implementation, source/worktree identity, artifact measurements, commands and outstanding qualification. The latest follow-up has completed implementation and automated validation; real-device and real-material manual qualification remains pending. The linked report distinguishes the full matrix from subsequent targeted regression runs.

The default product remains a CMS HTML WYSIWYG editor with optional first-use HTML Source and two bounded split views. Existing public compatibility entries remain supported outside the default loading graph. The 1.2.0 release is authorized separately; it has no public API removals or budget increases. See [release notes](releases/1.2.0.md) for the reviewed scope and verification status.

## Current verification boundaries

- Current automated results and raw evidence: [optimization acceptance](cms-followup-2026-09-08.zh-CN.md).
- Real Safari, operating-system IME, Office clipboard and assistive technology: [manual qualification record](cms-manual-qualification.zh-CN.md), pending actual execution.
- A historical package version or HEAD alone does not identify the modified worktree; use the recorded file hashes and final artifacts.
- Publication status is not refreshed by local builds or release-artifact audits.

## Historical evidence

- [WS1–WS6 loading and editing acceptance](wysiwyg-source-evidence.zh-CN.md).
- [2026-09-06 CMS UX implementation and acceptance](cms-ux-improvement-plan.zh-CN.md).
- [Earlier large-document count-cache measurement](large-document-performance.zh-CN.md).
- [Historical release decision](wysiwyg-release-decision.md).

See [PRODUCT.md](PRODUCT.md), [ROADMAP.md](ROADMAP.md), and [wysiwyg-editor.md](wysiwyg-editor.md) for product authority.
