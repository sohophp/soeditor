# @soeditor/html

Standards-oriented HTML parsing, source locations, diagnostics, and semantic
serialization for SoEditor.

```ts
import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';

const result = parseHtmlFragment(
    '<product-card data-id="123">Hello</product-card>',
);

const html = serializeHtmlFragment(result.document);
```

The package preserves HTML structure; it does not sanitize or render content.
Its public tree and diagnostic types are owned by SoEditor. The underlying
standards parser is an implementation detail.
