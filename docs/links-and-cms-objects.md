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
