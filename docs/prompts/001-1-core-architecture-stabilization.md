# Codex Master Prompt — Phase 1.1 Core Architecture Stabilization

You are working on **SoEditor**.

Phase 1 has already been implemented and has undergone a read-only architecture review.

This task is **not Phase 2**.

Do not implement HTML parsing, visual editing, toolbar UI, CodeMirror, Markdown, preview, formatting, diagnostics, image, table, file manager, or any other deferred feature.

The purpose of this task is to stabilize the Phase 1 public API and core lifecycle before any additional architecture is built on top of it.

Read, in this order:

1. `AGENTS.md`
2. `docs/architecture.md`
3. `docs/prompts/001-bootstrap-core-architecture.md`
4. the current Phase 1 implementation and tests

Then implement the stabilization work below.

---

# 1. Scope

Fix the architecture issues identified during Phase 1 review.

Prioritize correctness and long-term API safety over backward compatibility with unreleased Phase 1 APIs.

Phase 1 has not been released as stable.

Breaking internal or accidental public APIs is allowed if necessary to restore the intended architecture.

Do not redesign unrelated parts of the core.

---

# 2. Critical: Published TypeScript Declarations Must Support NodeNext

The currently generated declarations use extensionless relative ESM imports and fail when consumed with:

```text
moduleResolution: NodeNext
```

This must be fixed.

Requirements:

* the published package must remain ESM;
* generated declarations must be consumable from a TypeScript project using NodeNext;
* do not solve this by telling consumers to use `moduleResolution: Bundler`;
* do not weaken TypeScript compatibility requirements.

Add an integration/consumer fixture that validates the packed package, not only source imports.

Recommended validation workflow:

```text
build package
↓
npm/pnpm pack
↓
install packed package into fixture
↓
run tsc using NodeNext
```

The fixture should use a configuration equivalent to:

```json
{
    "compilerOptions": {
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true
    }
}
```

Import the package from its public package entry point.

Do not test by importing repository source paths.

This consumer test must become part of repository verification.

---

# 3. Event Listener Failures Must Not Break Required Cleanup

The EventBus currently allows listener exceptions to escape directly.

This creates lifecycle corruption.

Required behavior must be explicitly defined.

## Cleanup paths

Mandatory cleanup must complete even if event listeners throw.

Examples include:

* plugin destruction
* command registry cleanup
* service registry cleanup
* event registry cleanup
* editor destruction

Use exception-safe control flow such as:

```text
try / finally
```

where required.

---

# 4. Preserve Original Command Errors

If a command throws:

```text
OriginalCommandError
```

and a listener attached to:

```text
command:error
```

also throws, the caller must still receive the original command error.

The error event must never replace the original command exception.

Conceptually:

```text
command.execute()
    ↓ throws A

emit command:error
    ↓ listener throws B

caller receives A
```

B may be reported through the configured event-error mechanism, but it must not replace A.

Add explicit tests.

---

# 5. Define Event Listener Error Policy

Do not leave event listener exception behavior accidental.

Introduce a clear policy.

A reasonable direction is:

* normal EventBus usage may report listener failures;
* infrastructure events whose failure must not interrupt lifecycle use a safe emission mechanism;
* listener failures remain observable;
* mandatory cleanup always proceeds.

Avoid silently swallowing errors.

Do not create an overly complex global error framework.

Prefer a small explicit design.

If introducing separate APIs such as:

```ts
emit(...)
emitSafe(...)
```

clearly document the semantic difference.

Alternative designs are acceptable if they preserve the architectural guarantees.

---

# 6. Editor Destroy Must Always Complete Cleanup

`editor.destroy()` must remain exception-safe.

Once destruction begins:

* all initialized plugins that require destruction must be visited according to lifecycle policy;
* commands must be cleaned;
* services must be cleaned;
* event listeners must be cleaned;
* editor must become destroyed.

A throwing:

```text
plugin:error
```

or:

```text
editor:destroy
```

listener must not leave the editor half destroyed.

Repeated destroy remains safe.

Also test concurrent repeated calls while an asynchronous destroy operation is pending.

Preferred behavior:

```ts
const a = editor.destroy();
const b = editor.destroy();

await Promise.all([a, b]);
```

must not run destruction twice or corrupt lifecycle state.

---

# 7. Remove Internal Lifecycle Operations From Public Consumer API

Current lifecycle/cleanup methods are emitted publicly, including concepts such as:

```text
PluginManager.initialize
PluginManager.destroy
CommandRegistry.clear
ServiceRegistry.clear
EventBus.clear
```

Tagging them only with:

```text
@internal
```

is not sufficient if consumers can still call them.

Consumers must not be able to destroy editor infrastructure manually.

Redesign the exposure model.

Preferred direction:

```text
Editor exposes public narrow interfaces
          ↓
internal implementation retains lifecycle controls
```

For example, public editor properties may expose interfaces such as:

```ts
CommandCollection
PluginCollection
ServiceCollection
EditorEvents
```

while internal concrete registries retain:

```text
clear
initialize
destroy
```

Do not expose cleanup/lifecycle methods from package public declarations.

---

# 8. Prevent Registry Bypass After Editor Destruction

Currently a consumer may potentially call concrete registry objects directly after:

```ts
editor.destroy()
```

and continue registering/executing commands.

This violates editor lifecycle guarantees.

After editor destruction, consumers must not be able to bypass:

```text
EditorDestroyedError
```

through public registry APIs.

Choose a clean architectural solution.

Do not scatter destroyed-state checks throughout every class unless truly necessary.

Prefer editor ownership and narrow public capabilities.

Add tests proving public APIs cannot revive or operate the destroyed editor.

---

# 9. Reentrant Dispatch Must Be Deterministic

Current behavior allows a state-change listener to synchronously dispatch another transaction before the outer transaction commits.

This can cause a committed nested state to be overwritten by the outer transaction.

This is unacceptable.

Choose and explicitly document one of these policies:

### Option A — Reject reentrant dispatch

When dispatch is already active:

```ts
editor.dispatch(...)
```

throws a typed error such as:

```text
ReentrantDispatchError
```

### Option B — Queue nested dispatch

Nested transactions execute after the current dispatch completes.

### Option C — Explicit serialized dispatch model

Equivalent deterministic semantics.

For Phase 1, prefer the simplest robust behavior.

**Recommended: reject synchronous reentrant dispatch.**

Reason:

* easiest semantics to understand;
* prevents lost updates;
* avoids prematurely building a transaction scheduler;
* can evolve later if queueing becomes necessary.

Add tests for reentrant dispatch attempted from:

```text
document:beforeChange
document:change
state:change
mode:change
```

No state change may be silently lost.

---

# 10. Configuration Contract

Current configuration accepts:

```ts
unknown
```

values but cloning/freezing only safely handles arrays and plain objects.

Do not attempt to recursively clone every possible JavaScript value.

Instead define a clear supported configuration-data policy.

Recommended direction:

SoEditor configuration should contain JSON-like / plain configuration values:

```text
null
boolean
number
string
arrays
plain objects
functions only where an API explicitly allows them
```

Decide how to handle:

```text
Date
Map
Set
class instances
cyclic objects
```

Preferred Phase 1 behavior:

* validate unsupported structures;
* throw a descriptive configuration error;
* do not silently retain mutable shared references;
* detect cyclic structures rather than recursively overflowing.

Document the contract.

Add tests.

---

# 11. Transaction Provenance

Transactions currently lack ownership/base-state provenance.

Fix this before future history and selection systems rely on the API.

A transaction should know enough to prevent obvious misuse.

At minimum consider:

```text
owning editor identity
base revision
committed state
```

Required guarantees:

* a transaction created by Editor A cannot be dispatched through Editor B;
* a transaction cannot be committed multiple times;
* stale transaction behavior is explicit;
* direct public construction should be reconsidered.

Preferred API:

```ts
const transaction =
    editor.createTransaction(...)
```

Transaction construction should not be part of the normal public consumer API.

If the concrete constructor must remain technically exported for typing reasons, prevent arbitrary valid transaction construction.

Prefer not to export it publicly.

Introduce typed errors where useful:

```text
TransactionOwnershipError
TransactionAlreadyCommittedError
StaleTransactionError
```

Do not overbuild future conflict resolution.

---

# 12. Exhaustive Operation Handling

The operation dispatcher must fail compile-time checks when a new `Operation` union member is introduced but not handled.

Use an exhaustive `never` check.

Example concept:

```ts
function assertNever(value: never): never {
    throw new Error(...);
}
```

The operation switch must remain exhaustive.

Add a focused internal test if appropriate, but TypeScript compile-time enforcement is the main objective.

---

# 13. Async Command Detection Must Be Realm Independent

Do not use:

```ts
result instanceof Promise
```

to determine whether a command is asynchronous.

Promises may originate from another realm.

Use Promise assimilation / thenable detection.

The behavior must correctly support:

```text
native Promise
Promise from another realm
PromiseLike / thenable
```

Required command event order:

For async commands:

```text
command:beforeExecute
↓
command executes
↓
promise resolves
↓
command:afterExecute
```

On rejection:

```text
command:beforeExecute
↓
command executes
↓
promise rejects
↓
command:error
↓
original rejection propagated
```

Add tests including a custom PromiseLike object.

---

# 14. Plugin Lifecycle State

PluginManager must track enough lifecycle state to destroy plugins correctly when initialization fails.

Explicitly define behavior for:

```text
constructor failure
init failure
ready failure
normal destroy
```

Do not blindly call:

```text
destroy()
```

on every constructed plugin unless that is the documented contract.

Recommended lifecycle states may include:

```text
constructed
initialized
ready
destroyed
```

But keep the implementation minimal.

Expected principle:

A plugin should only receive lifecycle callbacks that are valid according to the lifecycle stage it reached.

If initialization partially succeeds, cleanup should occur for components that require cleanup.

Define and test the exact contract.

Tests should include failures in:

* plugin constructor
* first plugin init
* middle plugin init
* ready hook
* destroy hook

Ensure other necessary cleanup still occurs.

---

# 15. Readonly Semantics

The existing `readonly` state needs explicit semantics before later features depend on it.

For Phase 1, choose one clear contract.

Recommended:

`readonly` is an editor policy that prevents user-facing editing operations but does not prohibit administrative API updates such as:

```ts
editor.setData(...)
```

because applications may need to refresh read-only content.

However, Phase 1 has no real user editing engine yet.

Therefore document:

```text
readonly currently represents editing policy state.
Core programmatic document replacement remains allowed.
Future visual/source user-origin editing must respect readonly.
```

Do not introduce speculative enforcement that will interfere with CMS-controlled updates.

Add a test documenting current semantics.

---

# 16. ServiceToken Public Shape

Do not expose a public phantom field such as:

```ts
__service?: Service
```

only for generic inference.

Use an internal unique-symbol brand or another type-level mechanism that does not become an ordinary public property.

The intended public conceptual shape remains:

```ts
interface ServiceToken<T> {
    readonly id: string;
}
```

Do not expose unnecessary implementation fields.

---

# 17. Transaction Metadata

Review the additional transaction metadata API introduced beyond the original milestone.

Do not remove useful functionality automatically.

But simplify if the current metadata API:

* exposes premature policy;
* recursively clones values inconsistently;
* creates unclear object-identity guarantees.

Keep only the minimal API needed for transaction metadata.

Document whether metadata is:

```text
immutable snapshot
opaque values
plain data
```

Avoid inventing a complex serialization contract.

---

# 18. Public TSDoc

Complete missing TSDoc for public API.

Focus on:

* public classes
* public interfaces
* public fields whose semantics are not obvious
* lifecycle hooks
* state fields
* options
* commands
* engine shell APIs
* errors where useful

Do not add noisy comments to trivial internal implementation details.

TSDoc should describe behavior and contracts, not restate TypeScript syntax.

---

# 19. Node LTS Reproducibility

The repository currently specifies an engine version but does not pin the intended development runtime.

Add one standard mechanism such as:

```text
.nvmrc
```

or:

```text
.node-version
```

Use the stable Node.js LTS version selected for this repository.

Keep:

```text
package.json engines
```

consistent.

Do not introduce multiple competing Node version managers unless the repository already requires them.

---

# 20. Repository Hygiene

Correct the milestone prompt filename if it currently contains an accidental leading space:

```text
docs/prompts/ 001-bootstrap-core-architecture.md
```

to:

```text
docs/prompts/001-bootstrap-core-architecture.md
```

Preserve content.

Do not make meaningless whitespace-only modifications to:

```text
AGENTS.md
docs/prompts/*
```

unless needed for this task.

Review:

```bash
git diff
git status
```

before completion.

Remove accidental changes.

---

# 21. Required Tests

Add or update tests covering at least:

1. packed-package NodeNext consumer compilation;
2. throwing `plugin:error` listener;
3. throwing `editor:destroy` listener;
4. throwing `command:error` listener while preserving the original command error;
5. reentrant dispatch attempts;
6. public registry behavior after editor destruction;
7. plugin constructor/init/ready/destroy failures;
8. unsupported/cyclic configuration values;
9. PromiseLike command results;
10. transaction reuse;
11. cross-editor transaction dispatch;
12. repeated concurrent destroy;
13. readonly semantics;
14. exhaustive operation handling where practical.

Do not remove existing valid tests.

---

# 22. Public API Review

After fixing the issues, inspect the generated:

```text
packages/core/dist/*.d.ts
```

as if you were an external npm consumer.

Check for accidental exposure of:

* lifecycle internals
* cleanup methods
* mutable implementation types
* phantom fields
* internal helpers
* concrete types that should be interfaces

The package root should expose only deliberate public API.

---

# 23. Verification

Run all repository verification tasks.

At minimum:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run the new NodeNext package consumer validation.

If package-consumer testing has a dedicated script, include it in the normal verification workflow.

All checks must pass before completion.

---

# 24. No Deferred Features

Do not implement:

* HTML parser
* parsed document tree
* contenteditable
* visual editor
* selection engine
* history engine beyond existing Phase 1 requirements
* toolbar
* UI framework
* CodeMirror
* Markdown
* preview
* formatter
* diagnostics
* image
* link
* list
* table
* file manager
* SoFinder integration
* CDN build

This task is exclusively Core stabilization.

---

# 25. Completion Report

At completion report:

## Fixed High-Severity Issues

Explain how each of the four critical review findings was resolved.

## Public API Changes

List accidental or unsafe Phase 1 APIs that were removed or narrowed.

## Lifecycle Semantics

Explain:

* event-listener errors;
* plugin failure cleanup;
* editor destruction;
* reentrant dispatch;
* transaction ownership.

## Tests Added

List the new behavioral/integration tests.

## Consumer Compatibility

Report NodeNext packed-package test result.

## Verification

Report:

```text
lint
typecheck
test
build
consumer test
```

## Remaining Risks

Identify any remaining architecture concerns honestly.

Do not claim Phase 1 is stable if known high-severity architectural problems remain.

---

# Final Acceptance Condition

Do not begin Phase 2.

Phase 1.1 is complete only when:

* all four high-severity review findings are resolved;
* lifecycle cleanup cannot be interrupted into an inconsistent state;
* public API no longer exposes editor lifecycle controls accidentally;
* dispatch behavior is deterministic;
* published TypeScript declarations work in a real NodeNext consumer;
* transactions cannot be trivially reused across editors;
* tests cover the reviewed failure scenarios;
* lint, typecheck, test, build, and package-consumer verification pass.
