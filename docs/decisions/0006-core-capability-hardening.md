# ADR 0006: Core capability hardening

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 1.1 left event publication reachable through the editor's runtime event
object and assigned the shared destruction promise after cleanup could begin.
PromiseLike and configuration-array edge cases also bypassed intended error and
plain-data policies.

## Decision

The public editor event capability is a frozen subscription-only facade over an
internal publisher. An editor establishes its destruction promise before
invoking any plugin hook, and retains that promise for all later calls.

Command execution reads a result's `then` property once inside command error
handling and assimilates a captured callable. Configuration accepts only dense
ordinary arrays with data-property indices. Core event callbacks remain a
synchronous, non-awaited contract.

## Consequences

Consumers cannot forge lifecycle or state events through `editor.events`.
Reentrant destruction has deterministic promise identity without a scheduler.
Accessor thenables and arrays no longer bypass error reporting or immutable
plain-data validation. No Phase 2 behavior is introduced.
