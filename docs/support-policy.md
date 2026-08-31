# Compatibility and support policy

This policy defines the SoEditor 1.x contract beginning with the published
`1.0.0` release.

## API classifications

Every declared package entry point is recorded in
[`api-report.md`](api-report.md). The generated report is the authoritative
inventory and uses four classifications:

- **stable** — covered by the documented 1.x SemVer policy;
- **experimental** — public and supported for evaluation, but may change in a
  minor release with migration notes;
- **deprecated** — still supported but scheduled for removal according to the
  policy below;
- **internal** — every undeclared subpath, implementation module, private
  symbol, and concrete registry/renderer not present in the report.

The report currently has no deprecated exports. A symbol is not public merely
because TypeScript can reach it from a source checkout or it is present in an
npm tarball.

## SemVer and deprecation

For stable APIs in 1.x:

- patches may fix defects and security issues without intentionally changing
  documented behavior or types;
- minors may add backward-compatible APIs and capabilities;
- removals, incompatible type changes, and documented behavioral breaks require
  a major release;
- a stable API must be deprecated in documentation and declarations, name its
  replacement or migration path, and remain available for at least one
  subsequent minor release before major-version removal;
- experimental APIs may change or be removed in a minor release, but the
  changelog and migration guide must identify the change. Patch releases do not
  intentionally break experimental APIs.

All `@soeditor/*` packages are qualified and supported as one aligned version
set. Mixing minor versions is unsupported even when a package manager can
resolve the dependency graph.

## Runtime support matrix

| Runtime                                    | 1.0 qualification level                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                                    | `>=22.14.0 <23`, as declared by package manifests and CI                                                                                  |
| Chromium browsers                          | Current Playwright Chromium used by CI; full editor, accessibility, security, and lifecycle                                               |
| Chrome / Edge                              | Supported when matching the qualified Chromium platform                                                                                   |
| Firefox / Safari                           | CMS matrix defined; current Linux host cannot launch Playwright Firefox/WebKit due system libraries, so product assertions remain pending |
| React                                      | `>=18.2.0 <20`; SSR import/render and real Chromium lifecycle coverage                                                                    |
| Vue                                        | `^3.5.0`; SSR import/render and real Chromium lifecycle coverage                                                                          |
| TypeScript                                 | Strict NodeNext and bundler consumers using the repository-qualified TypeScript line                                                      |
| ESM / Vite / direct-browser global and CSS | Release-gated                                                                                                                             |

SoEditor does not claim support for CommonJS `require`, Internet Explorer,
unqualified DOM emulators, framework versions outside peer ranges, or browser
features not exercised by the relevant adapter. Core remains DOM-free; browser
packages require a real browser environment for interactive behavior.

## Security and maintenance

Security reports should use the repository's private vulnerability reporting
channel. Do not disclose an unpatched vulnerability in a public issue. There is
no contractual response-time SLA, but confirmed issues are prioritized by
severity and corrected on the newest supported line.

The newest 1.x minor receives compatibility, security, accessibility, and
correctness fixes. Older minors may be superseded by the next minor; a
separately announced long-term-support line is not implied. npm deprecation is
preferred over unpublishing a defective immutable version.

Security boundaries remain explicit: preserved HTML is not permission to
execute it, Preview is isolated by default, plugin tooling is not a trust or
malware verdict, and host applications own authorization, storage, CSP,
uploaded assets, and backend validation.

## Change procedure

Any public API change must:

1. update declarations and classification intentionally;
2. run `pnpm api:report` and review the symbol, signature, entry, and declaration-
   tree hash diff;
3. preserve the 0.9 compatibility consumer unless a documented classification
   permits a change;
4. update the changelog and migration guidance;
5. pass `pnpm test:api` plus the normal release gates.

The report is a review gate, not proof that two implementations behave
identically. Behavioral tests, packed consumers, browser scenarios, and the
documented contracts remain part of compatibility qualification.
