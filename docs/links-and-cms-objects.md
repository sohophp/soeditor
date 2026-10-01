# Links and CMS content objects

`cmsPreset` provides command-driven links, named anchors, page breaks,
placeholders, configured CMS objects, and inert provider-metadata embeds. Host
services select internal content and resolve metadata; they never receive
permission to inject executable markup into the editing surface.

## Link policy

Configure the accepted schemes per editor instance:

```ts
const config = {
    cms: {
        links: {
            allowRelative: true,
            protocols: ['http', 'https', 'mailto', 'tel'],
        },
    },
};
```

`link.set`, `link.remove`, `link.inspect`, and `link.auto` share the Visual
selection and transaction boundary. `_blank` links deterministically receive
`noopener noreferrer`; `rel` values are normalized to a bounded allowlist.
Executable schemes, URL credentials, protocol-relative targets, backslashes,
controls, and schemes outside the configured policy are rejected before a
transaction.

Applications may register `linkTargetProviderServiceToken` with a
`LinkTargetProvider`. `link.pick` requests either `internal` or `file`; a null
result is cancellation and leaves the document unchanged. Returned options
pass the same link policy as manually entered values.

The Link dialog uses Basic settings and Advanced settings tabs. Text, URL and
file selection belong to Basic settings; title, target, relationships and custom
attributes belong to Advanced settings. Both tabs share a fixed viewport-bounded
dialog height, retain entered values and scroll longer content within the panel.
Left/Right and Home/End switch tabs from the tab bar. Validation reveals the tab
containing an invalid field before focusing it.

The Link dialog shows a file chooser when a provider is registered. A provider
may also implement `searchInternal(query)`. SoEditor calls it only after the URL
field begins with one `/`, with a 200 ms input delay, and displays at most 20
plain-text suggestions. Hosts should search a bounded result set on demand and
return public, deployment-independent URLs; file picker storage URLs should be
converted to the host's public file-page URL before returning from `select`.
The chooser is an icon at the end of the URL field. Suggestions appear below
that field, with titles and URLs on separate lines. Authors can use Up/Down and
Enter to select a suggestion, or Escape to dismiss the list.
When search is enabled, the suggestion list fills the remaining Basic settings
panel height so more pages are visible without moving the dialog or URL input.
The dialog is bounded to 820px wide, and its height grows with text scale while
remaining within the viewport.
Fields share the same edges in both tabs; target controls use equal-width columns.
Searches pause during IME
composition, and dismissed or superseded requests cannot reopen the list.
This behavior belongs to the editor and requires no host layout workaround.

```ts
import {
    linkTargetProviderServiceToken,
    type LinkTargetProvider,
} from '@soeditor/rich-text';

const provider: LinkTargetProvider = {
    select: async (kind) => kind === 'file'
        ? openFileManagerAndReturnPublicLink()
        : null,
    searchInternal: async (query) => searchSitePages(query),
};
editor.services.register(linkTargetProviderServiceToken, provider);
```

## Registered objects

`CmsObjectsPlugin` reads at most 64 definitions from `cms.objects`:

```ts
const config = {
    cms: {
        objects: [
            {
                element: 'aside',
                id: 'promotion',
                label: 'Promotion',
                properties: ['campaign', 'theme'],
            },
        ],
    },
};
```

This registers `cmsObject.promotion.insert`, `.update`, and `.remove`. Values
become bounded `data-*` attributes on an atomic structured block. The node view
uses text-only DOM and the serializer retains source attributes the definition
does not own. Unknown CMS elements remain preserved and inert.

The plugin also owns `specialCharacter.insert`, `anchor.insert`,
`pageBreak.insert`, and `placeholder.insert`. Horizontal rules remain available
through `horizontalRule.insert`.

## Safe embed metadata

Register `cmsEmbedProviderServiceToken` with a `CmsEmbedProvider`, then invoke
`embed.insert` with an HTTP(S) URL. The provider returns only a bounded provider
ID, title, canonical URL, and optional thumbnail URL. SoEditor builds a
semantic inert figure itself. Extra HTML, iframe, or script fields are ignored;
unsafe returned metadata rejects the operation without changing canonical
source.

Remote scripts, oEmbed HTML, iframe execution, authentication, permissions,
and content lookup remain host responsibilities. Render executable media only
inside a separately designed sandboxed Preview integration.
