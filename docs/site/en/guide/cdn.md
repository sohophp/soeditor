---
title: 'CDN integration'
description: 'A page without a bundler can use the fixed-version CMS browser global. This path supports WYSIWYG only. Use npm and ESM for Source.'
---

# CDN integration

A page without a bundler can use the fixed-version CMS browser global. This path supports WYSIWYG only. Use npm and ESM for Source.

```html
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@soeditor/editor@1.3.0/dist/cms-styles.css"
/>
<textarea id="content" name="content"><p>Hello</p></textarea>
<script src="https://cdn.jsdelivr.net/npm/@soeditor/editor@1.3.0/dist/soeditor.global.js"></script>
<script>
    SoEditor.createClassicEditor(document.getElementById('content'), {
        locale: 'en',
        minHeight: 280,
    }).catch(console.error);
</script>
```

You can download these exact-version files and host them yourself. If the CDN is unavailable, use self-hosted files or an npm build. Keep versions pinned.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
