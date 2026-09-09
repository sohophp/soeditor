---
title: 'CDN integration'
description: 'A page without a bundler can use the fixed-version CMS browser global. This path supports WYSIWYG only. Use npm and ESM for Source.'
---

# CDN integration

A page without a bundler can use the fixed-version CMS browser global. This path supports WYSIWYG only. Use npm and ESM for Source.

```html
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@soeditor/editor@1.4.0/dist/cms-styles.css"
/>
<textarea id="content" name="content"><p>Hello</p></textarea>
<script
    src="https://cdn.jsdelivr.net/npm/@soeditor/editor@1.4.0/dist/soeditor.global.js"
    crossorigin="anonymous"
></script>
<script>
    SoEditor.createClassicEditor(document.getElementById('content'), {
        locale: 'en',
        minHeight: 280,
    }).catch(console.error);
</script>
```

You can download these exact-version files and host them yourself. If the CDN is unavailable, use self-hosted files or an npm build. Keep versions pinned.

Keep `crossorigin="anonymous"` when loading the main script across origins, and serve it with CORS response headers (jsDelivr supports this). Browsers need this setting to resolve the image tools loaded dynamically on first use.

## Self-hosted files

Version 1.4.0 includes video tools by default. Copy the complete published `dist` directory and preserve relative paths, including `classic-image-tools.js`, `video-runtime.js`, source maps and license notices. Image tools and video dialogs request companion files on first use. Allow the corresponding script origin in your CSP.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
