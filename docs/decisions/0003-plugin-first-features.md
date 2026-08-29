# ADR 0003: Plugin-first features

- Status: Accepted
- Date: 2026-08-29

## Decision

Editor features belong in plugins unless they are infrastructure shared by
independent features. Plugins declare dependencies explicitly and communicate
through commands, events, services, and stable editor APIs.
