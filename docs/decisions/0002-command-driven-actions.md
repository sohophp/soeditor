# ADR 0002: Command-driven actions

- Status: Accepted
- Date: 2026-08-29

## Decision

User-triggerable behavior is exposed through commands. Document-changing
commands create and dispatch transactions, which produce new immutable editor
states. UI code must not directly mutate editor state.
