# Preview

Preview renders canonical content into a sandboxed `srcdoc` iframe. It is a
projection, never the authoritative document or part of the main editor DOM.

```ts
import { createPreviewEngine } from '@soeditor/editor';

const preview = createPreviewEngine({
    editor,
    element: document.querySelector<HTMLElement>('#preview')!,
    configuration: {
        baseUrl: 'https://cms.example/articles/',
        context: { section: 'News' },
        styles: ['body { font-family: system-ui; }'],
        stylesheets: ['/content.css'],
        template:
            '<!doctype html><html><body><main data-section="{{ section }}">{{ content }}</main></body></html>',
        title: 'Article preview',
    },
});

editor.execute('editor.preview');
editor.execute('editor.preview.close');
```

Templates require exactly one `{{ content }}` marker. Context values are
escaped, stylesheet protocols are validated, relative URLs use the configured
HTTP(S) base, and the iframe receives an accessible title. Preserved scripts,
event handlers, unsafe embeds, refresh policies, and source-controlled security
policies are removed or rendered inert before preview.

The sandbox intentionally has no execution permissions. Preview is not a way
to run CMS scripts. Applications needing executable site behavior require a
separate trusted deployment environment outside SoEditor's preview boundary.
