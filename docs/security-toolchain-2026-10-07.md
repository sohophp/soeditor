# 2026-10-07 release toolchain security

The 1.5.0 release updates Vitest and its coverage provider to 4.1.11, sharp to
0.35.5, undici to 7.29.1, source-map-js to 1.2.2 and the affected
brace-expansion lines to patched versions. These are development/documentation
tools, with no new editor runtime dependencies.

## braces local mitigation

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects braces 3.0.3. The advisory currently lists no patched release; npm
returns 404 for the suggested 3.0.4. Changesets uses it through micromatch.

The checked-in pnpm patch rejects source nesting at 100 levels and uses an
iterative AST depth/cycle check before compile, expand and stringify enter their
recursive walkers. Ordinary workspace globs, ranges and nested alternatives
retain their semantics. A host-generated pattern beyond the bound now throws
`ERR_BRACES_DEPTH_LIMIT` instead of exhausting the stack.

`security:audit` first runs regression checks against the installed transitive
package, including 4,000-level string and 20,000-level AST inputs, cyclic ASTs and normal
micromatch workspace patterns. Only this mitigated advisory is excluded from
the generic registry audit; every other high/critical advisory still fails.
The package remains version 3.0.3: this is a local mitigation, not an upstream
fix or a claim that npm considers that version patched. Remove the patch and
targeted exclusion together after an upstream fix is published and verified.
