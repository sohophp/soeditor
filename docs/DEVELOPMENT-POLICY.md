# SoEditor Autonomous Development Policy

## Status

Active development policy.

This document defines how an autonomous coding agent should develop SoEditor through `docs/ROADMAP.md`.

The roadmap defines **what** to build.

This document defines **how** to proceed.

---

# 1. Sources of Truth

Before implementing work, use these repository documents in this priority order:

1. `AGENTS.md`
2. accepted ADRs under `docs/decisions/`
3. `docs/PRODUCT.md`
4. `docs/architecture.md`
5. `docs/ROADMAP.md`
6. current phase specification under `docs/prompts/`, if one exists
7. current implementation and tests

If these sources materially conflict, do not guess.

Apply the Stop Conditions in this document.

---

# 2. Current Starting Point

Phases 1–15 are complete and the SoEditor 0.5 Developer Preview release gate
has passed. The repository owner subsequently authorized Phase 16 publication
and stabilization work.

The current authorized roadmap phase is:

```text
Phase 19 — Persistent Projection Coordination (active)
```

The repository owner authorized the SoEditor 0.6 through 1.0 development goal
on 2026-08-29. Autonomous progression is currently bounded by the approved 0.6
roadmap through Phase 22. Later 0.7–1.0 implementation requires those roadmap
phases to be written deliberately from product evidence before work enters
their scope. npm publication, tags, and hosted releases remain separately
owner-controlled operations.

---

# 3. Autonomous Progression

The agent may proceed from one roadmap phase to the next without requesting routine user confirmation.

For each phase:

```text
Inspect
↓
Plan
↓
Implement
↓
Test
↓
Review
↓
Fix blockers
↓
Release gate
↓
Document
↓
Commit/checkpoint if repository policy allows
↓
Next phase
```

Do not ask the user routine implementation questions that can be resolved safely from:

- existing architecture;
- accepted ADRs;
- roadmap;
- tests;
- normal engineering judgment.

---

# 4. Phase Planning

Before coding a phase:

1. read the relevant repository documentation;
2. inspect current implementation;
3. identify affected packages;
4. inspect related tests;
5. identify architectural constraints;
6. define an internal implementation plan.

For Phase 3 and later, if no detailed prompt already exists, create:

```text
docs/prompts/<phase-number>-<short-name>.md
```

as an implementation record.

The generated phase document must:

- derive its scope from `docs/ROADMAP.md`;
- not expand product scope;
- list explicit deferred work;
- state Definition of Done;
- state relevant existing ADR constraints;
- avoid speculative architecture not required by the phase.

The phase prompt is a working implementation specification.

It must not override accepted ADRs.

---

# 5. ADR Policy

Create a new ADR only when implementation introduces a meaningful architectural decision that future developers need to understand.

Examples:

- choosing a major parser/editor dependency;
- choosing a canonical representation;
- defining a significant public extension boundary;
- establishing lifecycle/security semantics;
- adopting a long-lived cross-package architecture.

Do not create ADRs for:

- ordinary helper classes;
- directory choices;
- test organization;
- minor private abstractions;
- routine bug fixes.

Before creating an ADR:

1. inspect existing ADRs;
2. update an existing ADR if the decision is already covered;
3. do not create duplicate decisions.

Use the next available ADR number.

Accepted ADRs must not be silently reversed.

---

# 6. Architecture Documentation

Update `docs/architecture.md` when the implemented system architecture materially changes.

Architecture documentation should describe the system that actually exists.

Do not write large speculative architecture sections for features that have not been implemented.

Product intent belongs in `docs/PRODUCT.md`.

Future sequence belongs in `docs/ROADMAP.md`.

Architectural rationale belongs in ADRs.

---

# 7. Implementation Scope

Implement only the current roadmap phase.

Do not opportunistically begin later phases.

For example, while implementing the HTML layer, do not add:

- visual editor;
- toolbar;
- CodeMirror;
- Markdown;
- Preview;

unless the roadmap/current phase explicitly requires them.

Small internal prerequisites are allowed when genuinely necessary.

They must not become hidden implementations of later product features.

---

# 8. Dependency Policy

Before adding a runtime dependency:

1. verify that the current phase genuinely needs it;
2. check whether an existing dependency already provides the capability;
3. prefer focused maintained packages;
4. consider browser compatibility;
5. consider bundle impact;
6. avoid application UI frameworks in core/editor architecture.

A normal focused dependency required by the roadmap may be added autonomously.

Examples likely acceptable when the relevant phase arrives:

```text
parse5
CodeMirror 6 packages
a mature Markdown parser
Prettier browser packages
```

A major/heavy dependency that changes architecture triggers a Stop Condition.

---

# 9. Public API Policy

Treat exported APIs as deliberate product surface.

Before exporting something:

- verify that external consumers need it;
- prefer narrow capability interfaces;
- avoid exposing concrete implementation registries;
- avoid third-party dependency AST/types unless intentionally accepted;
- avoid exporting internal helpers;
- provide TypeScript types.

Generated `.d.ts` output is part of the public API review.

---

# 10. Test Policy

Every phase must add meaningful tests for its new behavior.

Tests should include:

```text
normal cases
boundary cases
failure cases
adversarial cases
regressions for discovered defects
```

Do not optimize only for coverage percentage.

Do not remove valid tests merely to make implementation pass.

Important core/editor behavior should be tested independently from the UI where possible.

---

# 11. Adversarial Review

After implementation and normal verification, perform a read-only adversarial review of the current phase.

The review must:

- inspect code rather than trusting the implementation summary;
- inspect public declarations where relevant;
- run focused runtime probes where useful;
- attempt malformed/unexpected inputs;
- check lifecycle/error paths;
- check preservation/data-loss risks;
- check accidental public API leakage;
- check package-consumer behavior when relevant.

Classify findings:

```text
Critical
High
Medium
Low
```

---

# 12. Finding Severity

## Critical

Examples:

- data corruption/loss in primary supported workflows;
- editor resurrection/lifecycle corruption;
- exploitable security boundary failure;
- package fundamentally unusable;
- architecture invariant fundamentally violated.

Critical findings block phase completion.

---

## High

Examples:

- major supported workflow broken;
- public API contract materially unsafe;
- deterministic state/lifecycle violation;
- semantic HTML preservation failure;
- serious cross-package architecture defect.

High findings block phase completion.

---

## Medium

Examples:

- meaningful edge-case defect;
- maintainability concern;
- incomplete diagnostics;
- non-primary compatibility limitation;
- issue that can be fixed without redesigning the completed phase.

Medium findings do not automatically block progression.

Record them when not fixed.

---

## Low

Examples:

- documentation gaps;
- minor diagnostics;
- uncommon ergonomics;
- low-risk internal cleanup.

Low findings do not block progression.

---

# 13. Fix Cycle

After the first adversarial review:

```text
Critical → fix
High     → fix
```

Medium and Low may be fixed when:

- the fix is narrow;
- the risk of regression is low;
- it materially improves the current phase.

Do not enter endless hardening.

After Critical/High fixes, perform one final focused release-gate review.

Maximum normal cycle:

```text
implementation
↓
review
↓
Critical/High fix
↓
final gate
```

Do not repeatedly invent Phase X.1, X.2, X.3 unless a genuinely separate architectural stabilization effort is required.

---

# 14. Phase Release Gate

A phase may advance when:

```text
Critical = 0
High = 0
```

and:

- lint passes;
- typecheck passes;
- tests pass;
- build passes;
- relevant package-consumer checks pass;
- Definition of Done is substantially satisfied.

Medium/Low findings do not block progression unless they imply a breaking redesign would be necessary in the next phase.

---

# 15. Verification

At minimum, run repository-standard commands such as:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Preserve any existing package-consumer or runtime-smoke verification introduced by previous phases.

As new distribution targets are introduced, add corresponding verification.

Do not remove previous verification merely because it increases runtime.

---

# 16. Browser Verification

For browser-dependent phases, unit tests alone are insufficient.

When visual editing/UI/source-mode functionality is introduced, add browser-level tests or automated browser verification appropriate to the repository.

Test real interactions such as:

- typing;
- selection;
- undo/redo;
- paste;
- mode switching;
- dialogs;
- preview;
- keyboard shortcuts.

Do not rely exclusively on jsdom for browser editing behavior when real browser behavior matters.

---

# 17. HTML Preservation Review

Any phase touching HTML parsing/editing/serialization must actively test preservation.

Use adversarial fixtures including patterns such as:

```html
<product-card data-id="1" custom-property="value"></product-card>
```

```html
<!-- CMS:block:start -->
```

```html
<svg>
    <foreignObject>
        <div>Hello</div>
    </foreignObject>
</svg>
```

```html
<template>
    <custom-element></custom-element>
</template>
```

```html
<p>
    text
    <section>invalid nesting</section>
</p>
```

Do not assume valid/simple HTML is sufficient.

---

# 18. Security Review

Keep these concerns distinct:

```text
parse
preserve
sanitize
render
execute
```

When introducing Preview, HTML rendering, URLs, file managers, or dynamic plugin loading, explicitly review security boundaries.

Do not weaken sandboxing, URL validation, DOM isolation, or browser security merely for convenience.

---

# 19. Performance Policy

Do not prematurely optimize hypothetical bottlenecks.

However, editor interactions must eventually feel responsive.

Measure when introducing:

- large HTML documents;
- visual synchronization;
- source synchronization;
- diagnostics;
- formatting;
- preview refresh;
- large plugin sets.

Avoid architecture that requires reparsing/re-rendering the entire document for every keystroke unless proven acceptable for the current target.

---

# 20. Backward Compatibility

Before 1.0, public APIs may evolve.

Breaking changes must still be deliberate.

When a later phase reveals that an earlier public API is wrong:

1. determine whether the change is genuinely necessary;
2. update relevant ADR/documentation;
3. add migration notes where external usage already exists;
4. avoid preserving a clearly wrong architecture solely for compatibility with unreleased prototypes.

---

# 21. Repository Hygiene

Before completing a phase:

```bash
git status
git diff
```

Review for:

- accidental generated files;
- temporary fixtures;
- debug logs;
- unrelated changes;
- whitespace-only edits;
- accidental documentation rewrites;
- untracked build artifacts.

Do not rewrite existing product/architecture documents merely for stylistic preference.

---

# 22. Commit/Checkpoint Policy

If the environment and repository workflow permit autonomous commits, create a coherent checkpoint after a phase passes its release gate.

Suggested style:

```text
feat(html): complete phase 2 document layer
feat(engine): complete phase 3 visual engine
```

Do not commit known Critical/High defects.

Do not rewrite published Git history.

If autonomous commits are not appropriate in the current environment, leave the verified working tree and clearly report the checkpoint that should be committed.

---

# 23. Stop Conditions

Stop autonomous roadmap progression and report to the user when any of the following occurs.

## Accepted ADR must be reversed

If the current phase appears to require reversing an accepted ADR in a material way.

---

## Major Core public API redesign

If progression requires a broad breaking redesign of stable Phase 1 Core public APIs rather than a narrow extension.

---

## Major dependency architecture change

Examples:

- replacing parse5 after it has become foundational;
- replacing the visual editing strategy entirely;
- introducing React/Vue as an editor-core dependency;
- adopting a large external editor framework as the underlying editor.

---

## Security architecture uncertainty

Stop when a feature would require a significant new execution/trust boundary and there is no clear safe design.

---

## Roadmap conflict

Stop if two roadmap/product requirements materially contradict each other.

---

## Review cannot converge

If after:

```text
implementation
→ review
→ Critical/High fixes
→ final gate
```

Critical or High defects remain and resolving them requires substantial redesign.

---

## Scope explosion

Stop when the current phase cannot reasonably be completed without implementing a major portion of one or more later phases.

---

# 24. Do Not Stop For Routine Engineering Decisions

Do not stop autonomous development merely to ask about:

- internal class names;
- private helper structure;
- test file organization;
- ordinary refactoring;
- trivial TypeScript typing choices;
- minor directory layout;
- implementation details already constrained by architecture;
- narrow bug fixes;
- normal dependency version updates.

Use sound engineering judgment.

---

# 25. Phase Completion Report

At the end of each phase, record/report:

```text
Summary
Architecture changes
Public API changes
ADR changes
Tests
Review findings
Remaining Medium/Low risks
Verification
Release-gate result
Next roadmap phase
```

Do not claim a phase is complete when Critical or High findings remain.

---

# 26. Automatic Next-Phase Preparation

When a phase passes its release gate:

1. read the next phase in `docs/ROADMAP.md`;
2. inspect the newly completed architecture;
3. create the detailed phase prompt if one does not already exist;
4. ensure it does not conflict with accepted ADRs;
5. begin implementation.

Do not ask the user for routine approval between phases.

---

# 27. End of Autonomous Roadmap

Autonomous development ends after:

```text
Phase 15 — SoEditor 0.5 Release Hardening
```

passes its release gate.

Do not automatically begin Post-0.5 candidate work.

At that point provide a final report covering:

- implemented capabilities;
- package structure;
- major ADRs;
- known Medium/Low issues;
- public API status;
- documentation;
- build/distribution status;
- recommended next roadmap options.
