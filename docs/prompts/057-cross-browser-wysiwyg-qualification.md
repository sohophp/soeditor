# Phase 57 — Cross-browser WYSIWYG Qualification

## Objective

Turn the Phase 56 Firefox/WebKit environment blocker into reproducible product
evidence without weakening the WYSIWYG contract or claiming unexecuted Safari
and assistive-technology coverage.

## Scope

- run `cms-multibrowser.spec.ts` and `wysiwyg-editor.spec.ts` on Firefox and
  WebKit in a maintained Playwright environment;
- fix demonstrated Shadow DOM selection, range restoration, paragraph-boundary
  editing, word-count, and synthetic-paste interoperability defects;
- add an independent CI job that installs Firefox and WebKit and executes the
  same focused corpus;
- keep Chromium-only native clipboard permission and CDP IME injection checks
  explicit, while retaining equivalent Firefox/WebKit composition and paste
  behavior tests;
- update qualification, release-decision, roadmap, and changelog evidence.

## Constraints

- HTML remains canonical and state changes remain command/transaction driven;
- unsupported or unsafe HTML is preserved separately from execution;
- no browser assertion may be removed or relaxed merely to make a matrix green;
- no npm publication, Git tag, hosted release, or push is authorized;
- WebKit automation is not a claim of real Safari hardware or assistive-
  technology certification.

## Completion record

The matching official Playwright Noble image executes 70 Firefox/WebKit runs:
66 applicable assertions pass and four Chromium-tool-specific checks are
explicitly skipped. The new CI job repeated this result successfully on Ubuntu
for commit `1fe622c8b17771daeabc256e0ea127e52d311c83` in Actions run
`33460058428`. Production publication remains NO-GO until real Safari/manual
accessibility sign-off is complete.
