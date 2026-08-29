# Codex Master Prompt — Phase 1.2 Core Hardening

SoEditor Phase 1 and Phase 1.1 are implemented.

A second independent read-only architecture review found:

* no Critical issues;
* one High-severity lifecycle issue;
* three Medium-severity API/contract issues;
* one Low-severity asynchronous event-listener concern.

This task is a narrow **Phase 1.2 Core Hardening** pass.

Do not begin Phase 2.

Read first:

1. `AGENTS.md`
2. `docs/architecture.md`
3. `docs/prompts/001-bootstrap-core-architecture.md`
4. `docs/prompts/001-1-core-architecture-stabilization.md`
5. relevant ADRs
6. current implementation and tests

Do not redesign unrelated architecture.

---

# 1. Fix reentrant destroy shared-promise semantics

Current behavior allows `editor.destroy()` called synchronously from inside a plugin `destroy()` hook to begin another destruction operation because the editor's pending destroy promise is not established early enough.

Required invariant:

> From the moment the first `editor.destroy()` call begins destruction, every subsequent `destroy()` call must return the exact same Promise instance until destruction completes.

This includes:

* repeated external calls;
* concurrent calls;
* calls from plugin `destroy()` hooks;
* calls from event listeners during destruction.

Do not merely ensure cleanup eventually succeeds.

The promise identity guarantee must hold.

Add tests equivalent to:

```ts
let nestedDestroy: Promise<void> | undefined;

class TestPlugin extends Plugin {
    destroy() {
        nestedDestroy = this.editor.destroy();
    }
}

const outerDestroy = editor.destroy();

expect(nestedDestroy).toBe(outerDestroy);
```

Also verify:

* plugin destruction occurs once;
* registries are cleaned once;
* lifecycle event ordering remains deterministic;
* repeated destroy after completion remains safe.

Prefer a minimal lifecycle fix.

Do not introduce a general task scheduler.

---

# 2. Narrow public event capabilities

External consumers must not be able to forge SoEditor lifecycle or state events.

Currently the editor-facing event API exposes `emit()` for core events.

This allows consumers to manually emit events such as:

```text
editor:ready
editor:destroy
document:change
state:change
plugin:error
```

without the corresponding editor transition.

This must be removed from the public editor-facing capability.

Preferred architecture:

```text
internal EventBus
    ├── subscribe
    ├── emit
    ├── safe emission
    └── clear

public EditorEvents
    ├── on
    └── once
```

Public consumers should receive a subscription-only interface.

Do not expose:

```text
emit
notify
clear
```

through `editor.events`.

Internal core implementation may retain a concrete EventBus with publishing and cleanup capabilities.

Generated package declarations must reflect this separation.

Add type-level/public API verification where practical.

Add a runtime/API test demonstrating that consumers cannot forge lifecycle events through the public editor instance.

Do not solve this by checking event names inside a public `emit()` method.

Use capability separation.

---

# 3. Harden PromiseLike command handling

Current PromiseLike detection may read a `then` property more than once.

Accessor-based thenables can therefore behave incorrectly.

A throwing `then` getter may also bypass `command:error` if detection occurs outside command error handling.

Required behavior:

* PromiseLike detection must be realm independent;
* a `then` accessor must not be read repeatedly as part of detection/assimilation;
* a throwing `then` accessor must be treated as a command execution failure;
* `command:error` must be emitted according to normal command error policy;
* the original error must be propagated;
* synchronous commands should preserve synchronous return behavior unless an accepted ADR explicitly changes that contract.

Add tests for:

## Stateful getter

Conceptually:

```ts
let reads = 0;

const value = {
    get then() {
        reads++;

        // Return different values across reads.
    }
};
```

The command system must not produce behavior that depends on a second accidental property lookup.

## Throwing getter

```ts
const value = {
    get then() {
        throw new Error('then getter failed');
    }
};
```

Expected behavior:

```text
command:beforeExecute
↓
command returns value
↓
then access throws
↓
command:error
↓
original error propagated
```

## Custom thenable

Continue supporting normal PromiseLike objects.

Do not regress:

* native Promise
* custom thenable
* rejected Promise
* cross-realm-compatible thenable semantics

Keep the implementation small.

---

# 4. Harden configuration array validation

Configuration validation currently validates ordinary objects more strictly than arrays.

Arrays must not provide a bypass for unsupported configuration structures.

Define and enforce an explicit array contract.

Recommended contract:

Configuration arrays may contain supported configuration values and ordinary array indices only.

Reject:

* accessor properties on array indices;
* symbol-keyed properties;
* nonstandard custom array properties;
* unsupported nested values;
* cyclic structures.

Sparse-array behavior must be explicit.

Prefer either:

* support ordinary sparse arrays deliberately; or
* reject sparse arrays for simpler semantics.

Do not accidentally invoke getters while cloning configuration.

Use property descriptors when necessary.

Do not rely solely on:

```ts
Array.prototype.map()
```

for validation.

Add tests for:

* accessor at numeric index;
* symbol property;
* custom string property;
* nested unsupported value;
* cyclic array;
* ordinary array;
* nested ordinary arrays.

Configuration cloning/freezing must remain deterministic and must not retain mutable references contrary to the documented contract.

---

# 5. Async event listener policy

The current EventBus listener contract is synchronous.

Do not turn the EventBus into an asynchronous event pipeline in this milestone.

Explicitly define:

> Core event listeners are synchronous callbacks. Returning a Promise is unsupported and is not awaited.

Make this contract clear in TSDoc.

Where TypeScript permits an async function to satisfy a void callback, consider whether a lightweight development-time safeguard is appropriate.

Do not add complex asynchronous listener scheduling.

Do not make editor lifecycle wait for arbitrary event listener promises.

The goal is to make the contract explicit, not to expand EventBus scope.

If rejected async listener promises cannot be safely observed without adding significant complexity, document this limitation clearly.

---

# 6. Public declarations

After changes, inspect generated declarations.

Verify:

* `editor.events` exposes subscription capability only;
* internal event publishing methods are not available through the public Editor API;
* no new lifecycle implementation details are leaked;
* existing NodeNext package-consumer compatibility remains valid.

Do not regress Phase 1.1 declaration fixes.

---

# 7. Regression requirements

All Phase 1 and Phase 1.1 guarantees must continue to hold:

* NodeNext packed-package consumption;
* deterministic dispatch;
* reentrant dispatch protection;
* original command-error preservation;
* cleanup exception safety;
* plugin partial-lifecycle cleanup;
* transaction ownership;
* transaction single-use behavior;
* registry protection after destroy;
* config defensive immutability;
* narrow registry interfaces;
* exhaustive operation handling.

Do not weaken previous tests to accommodate this hardening pass.

---

# 8. Required verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the packed-package NodeNext consumer validation.

All checks must pass.

---

# 9. Scope restrictions

Do not implement:

* HTML parsing
* parsed HTML tree
* contenteditable
* visual editing
* toolbar
* selection engine
* history expansion
* CodeMirror
* Markdown
* Preview
* formatting
* diagnostics
* image
* link
* table
* file manager
* SoFinder integration
* CDN distribution work

No Phase 2 implementation is allowed.

---

# 10. Completion report

Report:

## Destroy lifecycle

Explain how the same-promise invariant is guaranteed, including reentrant calls.

## Event capabilities

Explain the public subscription interface versus internal publishing interface.

## PromiseLike semantics

Explain how accessor-based thenables and throwing getters are handled.

## Configuration arrays

Explain the accepted array data contract and rejected structures.

## Event listener contract

State clearly whether listeners are synchronous-only.

## Tests

List newly added regression tests.

## Public API

Describe any public type changes.

## Verification

Report:

* lint
* typecheck
* tests
* build
* NodeNext consumer

## Remaining risks

Identify any remaining Core issues honestly.

Do not begin Phase 2.
