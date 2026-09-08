---
title: 'CDN 接入'
description: '没有打包工具的页面可以使用固定版本的 CMS 浏览器全局包。此路径仅支持 WYSIWYG；需要 Source 时采用 npm 与 ESM 接入。'
---

# CDN 接入

没有打包工具的页面可以使用固定版本的 CMS 浏览器全局包。此路径仅支持 WYSIWYG；需要 Source 时采用 npm 与 ESM 接入。

```html
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@soeditor/editor@1.3.0/dist/cms-styles.css"
/>
<textarea id="content" name="content"><p>Hello</p></textarea>
<script src="https://cdn.jsdelivr.net/npm/@soeditor/editor@1.3.0/dist/soeditor.global.js"></script>
<script>
    SoEditor.createClassicEditor(document.getElementById('content'), {
        locale: 'zh-CN',
        minHeight: 280,
    }).catch(console.error);
</script>
```

生产环境可下载这些固定版本文件并自行托管。外部 CDN 不可达时，改用自托管文件或 npm 构建；不要切换到未锁定的 latest。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
