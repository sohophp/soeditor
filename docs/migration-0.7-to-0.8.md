# Migrating from SoEditor 0.7 to 0.8

SoEditor `0.8.0` adds the public review-workflow packages while retaining the
0.7 structured editing APIs. Upgrade the complete aligned package set; do not
mix 0.7 and 0.8 `@soeditor/*` packages.

## Package changes

Two packages become public:

```bash
pnpm add @soeditor/comments@0.8.0 @soeditor/revisions@0.8.0
```

They are also exported by `@soeditor/editor`. The curated
`@soeditor/plugin-sdk` exports their plugin factories, service tokens, storage,
permission, model, export, and review-policy types. Plugin SDK consumers must
satisfy the new aligned peer dependencies.

## Dynamic readonly state

`Editor.setReadonly(boolean)` is now an application-level public API. Visual,
Source, and Markdown surfaces update without remounting. Applications that
previously treated `readonly` as construction-only should subscribe to normal
state changes or let the built-in projections propagate them.

`comments-only` sets content readonly but still permits comment actions that
the host permission provider allows. `readonly` blocks editor-facing comment
actions. Data export and permanent erasure remain separate, explicitly
authorized governance operations and are not elevated by either review mode.

## Storage migration

Existing comment adapters remain source-compatible. Their `save(threads)`
contract is now explicitly full-collection replacement. `delete(id)` still
creates a tombstone; use `erase(id)` only for authorized permanent removal.

Existing revision providers and storage adapters remain source-compatible.
Implement optional `RevisionStorage.erase(id)` to enable permanent revision
erasure. Without it, `service.can('erase', id)` returns `false`.

Add explicit permission handling for the new actions:

```ts
permissions: {
    can: ({ action }) =>
        action === 'export' ? user.canExport :
        action === 'erase' ? user.canErase :
        workflowPolicy.allows(action),
}
```

Review [data governance](review-data-governance.md) before enabling exports or
erasure. These client APIs do not delete backups, replicas, audit logs, or data
outside the adapter's authoritative store.

## Verification checklist

- update all `@soeditor/*` versions and peer ranges to `0.8.0`;
- test edit, comments-only, and readonly transitions in every mounted mode;
- test adapter failure, retry/reload, export authorization, and erasure;
- verify escaped historical source and inert unsafe HTML;
- destroy retained services and confirm they reject further use;
- run application accessibility and keyboard checks around review panels.
