# Codex Master Prompt — Phase 1.4 Startup Abort Finalization

SoEditor Phase 1 through Phase 1.3 are implemented.

A final independent release-gate review found one remaining High-severity defect:

> If a plugin calls `editor.destroy()` from an asynchronous `init()` or `ready()` hook and then returns a Promise that never settles, destruction completes but `Editor.create()` remains pending forever.

This violates the documented startup-abortion contract:

* destruction during startup must abort startup;
* required cleanup must complete;
* `Editor.create()` must reject;
* a plugin hook must not be able to keep aborted creation pending forever.

This task fixes that issue and a small set of directly related consistency gaps only.

Do not begin Phase 2.

Read first:

1. `AGENTS.md`
2. `docs/architecture.md`
3. all ADRs under `docs/decisions/`
4. all Phase 1 prompts through Phase 1.3
5. current editor/plugin/event/config implementation
6. existing tests

---

# 1. Startup hook waits must be destruction-aware

Plugin `init()` and `ready()` hooks may return:

```ts
void | Promise<void>
```

The startup pipeline must not blindly await a hook forever after editor destruction has already begun.

Required invariant:

> Once destruction begins during startup, editor creation must stop waiting for the plugin hook as the condition for completing startup abortion.

If destruction occurs while awaiting a plugin hook:

1. startup is considered aborted;
2. remaining plugin startup hooks must not run;
3. required editor destruction/cleanup must complete;
4. `Editor.create()` must reject with the existing initialization-aborted error;
5. editor creation must not remain pending because the plugin hook never settles.

---

# 2. Do not introduce a general cancellation framework

Do not add a repository-wide cancellation abstraction.

Do not redesign plugin hooks around `AbortSignal` in this milestone.

Keep the solution local to startup lifecycle waiting.

The goal is:

```text
destruction-aware lifecycle waiting
```

not:

```text
generic async task cancellation
```

---

# 3. Lifecycle race semantics

For an async plugin hook, the startup pipeline conceptually observes two outcomes:

```text
plugin hook settles
```

or:

```text
editor destruction begins
```

Whichever becomes relevant first determines startup behavior.

If the hook settles first:

* continue existing lifecycle behavior;
* preserve current success/error semantics.

If destruction begins first:

* stop startup progression;
* wait for the shared editor destruction operation to complete;
* reject `Editor.create()`;
* do not wait indefinitely for the plugin hook.

The exact internal implementation may use a race or another equivalent mechanism.

Do not expose this mechanism as public API.

---

# 4. Never-settling init regression

Add a plugin equivalent to:

```ts
class NeverSettlingInitPlugin extends Plugin {
    init(): Promise<void> {
        void this.editor.destroy();

        return new Promise(() => {});
    }
}
```

Required behavior:

```text
Editor.create()
↓
plugin init starts
↓
editor.destroy() starts
↓
destruction completes
↓
Editor.create() rejects
```

It must not remain pending.

Use a bounded regression test so the test suite itself cannot hang indefinitely.

Do not rely only on timeout failure.

Assert the actual initialization-aborted error.

---

# 5. Never-settling ready regression

Add the equivalent regression for:

```ts
ready(): Promise<void>
```

where the plugin:

```ts
void this.editor.destroy();

return new Promise(() => {});
```

Required behavior is the same:

* destruction completes;
* startup stops;
* `Editor.create()` rejects;
* no later ready hooks run;
* no `editor:ready` event is emitted.

---

# 6. Late hook settlement must not resurrect lifecycle

A hook may settle after destruction has already won the startup race.

Examples:

```text
destroy first
↓
startup aborted
↓
hook resolves later
```

or:

```text
destroy first
↓
startup aborted
↓
hook rejects later
```

Neither outcome may:

* advance plugin lifecycle;
* emit ready events;
* resurrect the editor;
* produce an unhandled Promise rejection.

Ensure late hook rejection is observed safely.

Do not silently convert it into a new editor startup failure after destruction has already determined the outcome.

If appropriate, route it through an internal error-observation path.

Keep semantics simple and documented.

---

# 7. Preserve ordinary hook failures

Do not regress normal plugin hook error behavior.

If no destruction occurs and:

```ts
init()
```

or:

```ts
ready()
```

rejects normally, existing initialization-failure behavior must remain intact.

The destruction-aware wait must distinguish:

```text
ordinary hook failure
```

from:

```text
startup aborted because editor destruction began
```

Do not mask ordinary plugin errors as initialization-aborted errors unless destruction actually occurred.

---

# 8. Preserve shared destroy promise semantics

Do not regress:

* concurrent destroy;
* reentrant destroy;
* destroy from plugin destroy hook;
* destroy during constructor/init/ready;
* same Promise identity;
* exactly-once cleanup.

The destruction-aware startup wait must use the existing lifecycle guarantees rather than create a second teardown path.

There must remain exactly one editor destruction operation.

---

# 9. Fix state notification isolation

Current state commit logic can allow a throwing listener for one notification to prevent later required notifications.

Example:

```text
state changes source + mode
↓
document:change listener throws
↓
mode:change not emitted
↓
state:change not emitted
```

The editor state has already committed, so required state notifications must not be skipped solely because an earlier listener failed.

Required behavior:

After state commit, each logically required notification must be attempted independently.

For a transaction that changes:

* document;
* mode;
* overall state;

the relevant events should each be attempted according to the event contract.

A listener failure for:

```text
document:change
```

must not suppress:

```text
mode:change
state:change
```

Preserve observability of listener failures.

Do not roll back committed state because a notification listener throws.

Do not create a complex event transaction system.

Prefer small exception-isolated post-commit notification logic.

Add a regression test.

---

# 10. Preserve original state semantics

Do not emit events for changes that did not occur.

Continue existing rules such as:

* no `document:change` for unchanged document source;
* no `mode:change` for unchanged mode;
* `state:change` only when state actually changes.

This task changes failure isolation, not event meaning.

---

# 11. Reject non-enumerable configuration accessors

The documented configuration policy rejects accessor properties.

Current plain-object cloning may skip non-enumerable properties before validating whether they are accessors.

Fix this inconsistency.

A plain object containing a non-enumerable accessor must be rejected rather than silently ignored.

Example:

```ts
const config = {};

Object.defineProperty(
    config,
    'hidden',
    {
        get() {
            return 'value';
        },
        enumerable: false
    }
);
```

This must fail according to the existing unsupported-config policy.

Do not broaden configuration support.

Add a regression test.

---

# 12. Document plugin destroy self-dependency restriction

Document explicitly:

> A plugin `destroy()` hook must not await the editor's own shared `destroy()` promise.

Reason:

```text
editor.destroy()
↓
plugin.destroy()
↓
await editor.destroy()
↓
shared destroy promise waits for plugin.destroy()
```

This forms a self-dependency.

This is a lifecycle usage restriction, not a reason to redesign the shared destroy promise.

Document it in:

* lifecycle ADR and/or architecture documentation;
* `Plugin.destroy()` TSDoc.

A plugin may observe or compare the returned destroy promise, but must not await the same editor's destruction from within its own destroy hook.

Do not add complex runtime deadlock detection unless there is already a simple reliable mechanism.

Documentation is sufficient for this issue.

---

# 13. Regression requirements

Do not regress existing guarantees:

* terminal destruction;
* `Editor.create()` never returns destroyed editor;
* constructor/init/ready startup destruction;
* editor:ready listener destruction;
* shared destroy Promise identity;
* reverse exactly-once plugin cleanup;
* command PromiseLike behavior;
* original command-error preservation;
* public subscription-only event capability;
* transaction provenance and single-use;
* reentrant dispatch rejection;
* configuration immutability;
* NodeNext declarations;
* packed Node ESM runtime;
* narrow public API.

Do not weaken existing tests.

---

# 14. Required tests

Add regression coverage for at least:

1. never-settling async `init()` after calling `editor.destroy()`;
2. never-settling async `ready()` after calling `editor.destroy()`;
3. late hook resolve after destruction;
4. late hook reject after destruction without unhandled rejection;
5. normal async hook rejection without destruction;
6. document-change listener throwing while mode/state notifications are still attempted;
7. non-enumerable configuration accessor rejection;
8. all existing destruction promise identity behavior.

Tests must be deterministic and must not depend on long arbitrary sleeps.

---

# 15. Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run:

* packed-package NodeNext TypeScript consumer;
* packed-package Node ESM runtime smoke test.

All required checks must pass.

---

# 16. Scope restrictions

Do not implement:

* HTML parser
* document tree
* visual editing
* contenteditable
* selection
* history expansion
* toolbar
* CodeMirror
* Markdown
* preview
* diagnostics
* formatter
* image
* table
* file manager
* SoFinder integration
* CDN distribution changes

No Phase 2 work is allowed.

---

# 17. Completion report

Report:

## Destruction-aware startup waiting

Explain how never-settling hooks no longer keep `Editor.create()` pending after destruction.

## Late hook settlement

Explain how late resolve/reject outcomes are handled safely.

## State notifications

Explain how committed state notifications are isolated from listener failures.

## Configuration validation

Confirm non-enumerable accessors are rejected.

## Lifecycle documentation

Confirm the plugin destroy self-dependency restriction is documented.

## Tests

List added regression tests.

## Verification

Report:

* lint
* typecheck
* tests
* build
* NodeNext consumer
* Node ESM packed runtime

## Remaining risks

List only current Core risks.

Do not begin Phase 2.
