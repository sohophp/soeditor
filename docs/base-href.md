# Relative URL base

Pass `baseHref: 'https://www.example.com/assets/'` to `createClassicEditor` alongside the CMS preset. Relative bases such as `/assets/` resolve against the host document; directory bases need a trailing slash. Only HTTP/HTTPS bases are accepted.

The instance resolves relative images, links, ordinary srcset, poster and inline CSS `url(...)` against this base. Saved HTML retains relative attributes and the host document is unchanged. Preview inherits the base unless `preview.baseUrl` overrides it. With no option, existing browser behavior is preserved.

This option does not configure upload directories, server storage or security policy.

Image properties read canonical `src`, `srcset` and image-link `href` values. The absolute URLs used by the rendering layer are not shown as the editable source and are not written back when updating the image.
