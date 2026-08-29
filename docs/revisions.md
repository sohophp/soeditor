# Revisions and review policy

Phase 28 provides the private development package `@soeditor/revisions`. It is
scheduled for public review-workflow hardening in Phase 29 and is not part of
the frozen 0.7 release candidate.

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
return the stored snapshot. SoEditor bounds a list to 200 revisions and each
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
