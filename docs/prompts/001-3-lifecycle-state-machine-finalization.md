# Codex Master Prompt — Phase 1.3 Lifecycle State Machine Finalization

SoEditor Phase 1, Phase 1.1, and Phase 1.2 have been implemented.

A final release-gate review found one Critical lifecycle defect:

> A plugin may call `editor.destroy()` during its constructor, `init()`, or `ready()` hook, after which `Editor.create()` can continue startup and transition the already-destroyed editor back into a usable `ready` state.

This task fixes that lifecycle defect only.

Do not begin Phase 2.

Read first:

1. `AGENTS.md`
2. `docs/architecture.md`
3. all existing lifecycle-related ADRs
4. `docs/prompts/001-bootstrap-core-architecture.md`
5. `docs/prompts/001-1-core-architecture-stabilization.md`
6. `docs/prompts/001-2-core-hardening.md`
7. current editor/plugin lifecycle implementation and tests

---

# 1. Core invariant

Editor destruction is terminal.

Once destruction begins, the editor startup lifecycle must never transition the editor back to an operational state.

The following must be impossible:

```text
destroying → ready
destroyed → ready
```

Once an editor enters:

```text
destroying
```

or:

```text
destroyed
```

startup must stop.

---

# 2. Explicit lifecycle state

Review the current editor lifecycle representation.

Use an explicit lifecycle state model rather than loosely related booleans if necessary.

The exact state names may vary, but the lifecycle must represent at least:

```text
startup/in-progress
ready
destroying
destroyed
```

Valid conceptual transitions:

```text
creating
    ↓
ready
    ↓
destroying
    ↓
destroyed
```

and:

```text
creating
    ↓
destroying
    ↓
destroyed
```

Invalid transitions include:

```text
destroying → ready
destroyed → ready
destroyed → creating
```

Do not create an unnecessarily complex generic state-machine framework.

Keep this editor-specific and small.

---

# 3. Startup must be abortable

`Editor.create()` must treat startup as an operation that can be aborted by destruction.

Startup currently includes conceptually:

```text
construct editor
↓
construct plugins
↓
plugin init
↓
plugin ready
↓
editor ready
```

After every lifecycle boundary where plugin code has executed, verify that startup is still allowed to continue.

If destruction has started:

* stop startup;
* do not invoke remaining startup hooks;
* do not set editor lifecycle to `ready`;
* do not emit `editor:ready`;
* complete required destruction/cleanup;
* reject `Editor.create()`.

Do not return a destroyed editor from `Editor.create()`.

---

# 4. Startup destruction error

Introduce or reuse a clear typed error representing startup abortion caused by destruction.

A suitable API could be:

```text
EditorInitializationAbortedError
```

or a more specific equivalent.

Requirements:

* error message is explicit;
* caller can distinguish startup failure from normal successful creation;
* do not expose an operational destroyed editor.

Example conceptual behavior:

```ts
await expect(
    Editor.create({
        plugins: [DestroyDuringInitPlugin]
    })
).rejects.toThrow(
    EditorInitializationAbortedError
);
```

---

# 5. Constructor-triggered destruction

Add a plugin that calls:

```ts
editor.destroy()
```

from its constructor.

Verify:

* startup stops;
* editor never reaches ready;
* `editor:ready` is not emitted;
* `Editor.create()` rejects;
* no command/service registered after destruction becomes usable;
* cleanup remains deterministic;
* destroy remains terminal.

Do not assume plugin constructors are side-effect free.

The lifecycle must remain safe even when plugin code behaves this way.

---

# 6. Init-triggered destruction

Add plugins that call:

```ts
editor.destroy()
```

during `init()`.

Test both synchronous and asynchronous forms where relevant.

Verify:

* remaining plugin init hooks do not continue after startup has been aborted;
* ready hooks are not invoked;
* initialized-plugin cleanup follows the documented plugin lifecycle policy;
* no plugin is incorrectly promoted to a later lifecycle state after destruction begins;
* `Editor.create()` rejects.

Pay special attention to:

```text
plugin init begins
↓
destroy starts/completes
↓
init function returns
```

The return of `init()` must not resurrect the plugin or editor lifecycle.

---

# 7. Ready-triggered destruction

Add a plugin that calls:

```ts
editor.destroy()
```

during `ready()`.

Verify:

* remaining ready hooks do not continue;
* `editor:ready` is not emitted after destruction;
* editor lifecycle remains destroyed;
* `Editor.create()` rejects;
* initialized plugin cleanup occurs exactly once.

A plugin that has been destroyed must never become ready afterward.

---

# 8. Terminal destroyed state

After destruction completes:

* commands cannot become usable again;
* services cannot become usable again;
* plugins cannot restart;
* state cannot transition to ready;
* startup code cannot mutate lifecycle back to operational;
* the cached destroy promise remains valid and safe.

Do not solve this only by clearing registries.

The lifecycle state itself must enforce the terminal invariant.

---

# 9. No post-destroy registration resurrection

Add regression tests proving startup code cannot perform operations after destruction that recreate editor capabilities.

Examples to test where relevant:

```text
register command after destruction
register service after destruction
continue plugin lifecycle after destruction
mark editor ready after destruction
```

Use the existing narrow registry and destroyed-state guarantees.

Do not duplicate checks unnecessarily if ownership/lifecycle guards can enforce them centrally.

---

# 10. Plugin lifecycle consistency

Preserve the previously accepted plugin cleanup policy.

Only plugins that reached the documented destruction-eligible lifecycle state should receive `destroy()`.

However:

* no plugin may advance lifecycle after editor destruction begins;
* a lifecycle hook completing after destruction started must not cause a later lifecycle transition;
* destruction must occur at most once per plugin.

Add regression tests for plugin lifecycle ordering.

---

# 11. Destroy promise semantics

Do not regress Phase 1.2 behavior.

The first call to:

```ts
editor.destroy()
```

must establish the single shared destruction promise before plugin cleanup can recursively call `destroy()`.

All subsequent calls during destruction return the same promise.

Keep tests for:

* concurrent destroy;
* destroy from plugin destroy hook;
* destroy during startup;
* destroy after completion.

---

# 12. Event semantics

Do not emit contradictory lifecycle events.

In particular, this sequence must never occur:

```text
editor:destroy
↓
editor:ready
```

or:

```text
destroyed
↓
editor:ready
```

Add explicit event-order tests.

Valid startup:

```text
startup
↓
editor:ready
```

Startup aborted by destruction:

```text
startup
↓
destruction
```

with no later `editor:ready`.

---

# 13. Public API

Do not broaden the public API.

Do not expose lifecycle mutation methods to consumers.

Lifecycle state may remain internal unless there is already a deliberate public read-only representation.

Do not add public setters such as:

```ts
setLifecycle(...)
markReady(...)
```

These must remain internal implementation capabilities.

---

# 14. ADR

Create or update an ADR documenting:

> Editor destruction is terminal.

The ADR must state:

* destruction may occur during startup;
* startup must abort;
* `Editor.create()` rejects;
* destroyed editors never become ready;
* plugin lifecycle cannot advance after destruction begins.

Suggested filename:

```text
docs/decisions/0006-editor-destruction-is-terminal.md
```

Use the next appropriate ADR number if numbering already differs.

---

# 15. Required tests

Add tests covering at least:

1. destroy from plugin constructor;
2. destroy from synchronous plugin init;
3. destroy from asynchronous plugin init;
4. destroy from plugin ready;
5. no remaining init hooks after startup abort;
6. no remaining ready hooks after startup abort;
7. no `editor:ready` after destruction begins;
8. `Editor.create()` rejects when startup is destroyed;
9. plugin destroy called according to lifecycle policy;
10. plugin destroy called at most once;
11. commands/services cannot resurrect after startup destruction;
12. terminal destroyed lifecycle;
13. concurrent/reentrant destroy promise identity remains intact.

Use adversarial lifecycle probes, not only happy-path tests.

---

# 16. Regression guarantees

Do not regress:

* NodeNext packed-package compatibility;
* narrow event subscription API;
* PromiseLike command semantics;
* configuration validation;
* transaction ownership;
* transaction single-use semantics;
* deterministic dispatch;
* reentrant dispatch rejection;
* plugin dependency resolution;
* plugin partial-failure cleanup;
* registry protection after destroy;
* shared destroy promise identity;
* generated declaration cleanliness.

Do not weaken existing tests.

---

# 17. Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run the packed NodeNext consumer validation.

If practical, execute the packed package using Node ESM as an additional runtime smoke test.

All required verification must pass.

---

# 18. Scope restrictions

Do not implement:

* HTML parsing
* document tree
* visual editor
* contenteditable
* selection engine
* toolbar
* CodeMirror
* Markdown
* preview
* formatter
* diagnostics
* image
* link
* table
* file manager
* SoFinder integration
* CDN work

This task is exclusively lifecycle finalization.

---

# 19. Completion report

Report:

## Lifecycle state machine

Describe valid and invalid lifecycle transitions.

## Startup abortion

Explain how destruction during constructor/init/ready stops startup.

## Editor.create behavior

Explain what error is returned when startup is destroyed.

## Plugin lifecycle

Explain which plugins receive destroy and how lifecycle advancement is prevented after destruction.

## Event ordering

Confirm `editor:ready` cannot occur after destruction begins.

## Tests

List all added lifecycle regression tests.

## Verification

Report:

* lint
* typecheck
* tests
* build
* packed NodeNext consumer
* packed runtime smoke test if run

## Remaining risks

Identify any remaining Critical or High lifecycle/core risks honestly.

Do not begin Phase 2.
