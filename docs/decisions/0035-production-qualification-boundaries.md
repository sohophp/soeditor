# 0035 — Production qualification boundaries

## Status

Accepted.

## Context

The frozen 1.0 candidate already has broad behavior tests, but production
qualification requires evidence and operational guidance without turning
environment-specific claims into editor features. Strict CSP also exposed a
missing pass-through for CodeMirror's generated styles.

## Decision

Qualification is recorded as a matrix of public user/integrator journeys,
automated accessibility/security/performance/lifecycle evidence, and explicit
environment limitations. Existing scenarios remain authoritative rather than
being duplicated into one oversized end-to-end test.

Source and Markdown engine options accept an optional application-generated
`cspNonce` and forward it only to CodeMirror's nonce facet. SoEditor does not
generate, store, infer, or globally register nonces. Empty values fail before a
surface mutates its host.

Theme colors apply to SoEditor-owned chrome rather than the application host.
Forced-colors focus gets a system-color outline. Reduced-motion qualification
permits the standard text-caret blink while requiring no other SoEditor
animation or transition.

Host deployment, backend rendering, authorization, persistence, monitoring,
CSP issuance, executable site Preview, and application leak prevention remain
outside editor ownership.

## Consequences

- strict nonce-based application CSP can support Source and Markdown without
  weakening the Preview boundary;
- qualification claims link to reproducible evidence and list missing human or
  cross-browser coverage;
- UI themes no longer leak text colors to unrelated host descendants;
- the candidate does not claim WCAG certification, leak freedom, universal
  browser support, or backend content safety.
