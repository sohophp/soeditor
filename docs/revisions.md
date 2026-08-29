# Revisions and review policy

`@soeditor/revisions` is a public 0.8 package. It is not part of the unpublished
0.7 release candidate.

The host owns revision persistence and identity:

```ts
import {
    createRevisionsPlugin,
    revisionsServiceToken,
} from '@soeditor/revisions';

const RevisionsPlugin = createRevisionsPlugin({
    author: () => ({ id: currentUser.id, name: currentUser.name }),
    initialPolicy: 'comments-only',
    permissions: {
        can: (context) => workflowPolicy.allows(context),
    },
    provider: revisionApi,
    storage: revisionApi,
});
```

The provider lists metadata and loads a complete immutable snapshot. Optional
storage accepts the current format/source plus `draft` or `saved` kind and must
return the stored snapshot. Its optional `erase(id)` method enables permanent
host-confirmed erasure. SoEditor bounds a list to 200 revisions and each
source to 5,000,000 characters. Hosts remain responsible for authorization,
retention, audit records, concurrency, and conflicts.

`view(id)` loads escaped, non-executable source and a semantic comparison
without changing `editor.getData()`. HTML is compared as source-location-free
SoEditor trees, so attribute order and entity spelling do not create false
changes. Markdown uses exact canonical lines. Output stops at 2,000 changes and
the UI source preview stops at 100,000 characters.

`restore(id)` is available only under `edit`, rejects a different document
format, and applies one `replace-document` transaction. The restored document
is dirty until the host saves it. Current comments remain unchanged while
viewing history; restore is intentionally ambiguous to mapped comments, which
therefore become unlinked instead of being repositioned heuristically.

Review policies are:

- `edit`: the current primary Visual, Source, or Markdown projection may write;
- `comments-only`: content is readonly but host-authorized comment actions may
  run;
- `readonly`: content and all comment actions are disabled.

Connect comments to the same service explicitly:

```ts
const CommentsPlugin = createCommentsPlugin({
    // author, ID, permissions, and storage omitted
    reviewPolicy: () =>
        editor.services.get(revisionsServiceToken).snapshot.policy,
});
```

Add both plugin constructors to the editor and add `revisions`/`comments` to
the toolbar. The Playground route
`/?comments=1&revisions=1&policy=comments-only` is an executable in-memory CMS
example.

## Export and erasure

`service.exportData()` loads every revision in the bounded current list and
returns an immutable versioned envelope. `service.erase(id)` is enabled only
when the storage adapter provides `erase`; it updates local state after the
adapter resolves. Both actions require explicit permission. Raw source in
exports must remain untrusted, and hosts must govern backups, replicas,
retention, and audit records as described in
[review data governance](review-data-governance.md).
