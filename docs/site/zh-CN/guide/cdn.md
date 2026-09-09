---
title: 'CDN 接入'
description: '没有打包工具的页面可以使用固定版本的 CMS 浏览器全局包。此路径仅支持 WYSIWYG；需要 Source 时采用 npm 与 ESM 接入。'
---

# CDN 接入

没有打包工具的页面可以使用固定版本的 CMS 浏览器全局包。此路径仅支持 WYSIWYG；需要 Source 时采用 npm 与 ESM 接入。

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
        locale: 'zh-CN',
        minHeight: 280,
    }).catch(console.error);
</script>
```

生产环境可下载这些固定版本文件并自行托管。外部 CDN 不可达时，改用自托管文件或 npm 构建；不要切换到未锁定的 latest。

跨域加载主脚本时必须保留 `crossorigin="anonymous"`，并确保托管服务返回允许跨域的响应头（jsDelivr 已支持）。浏览器需要此设置来解析首次使用时动态加载的图片工具地址。

## 自托管文件

1.4.0 默认提供视频工具。请复制整个发布包的 `dist` 目录并保留相对路径，包括 `classic-image-tools.js`、`video-runtime.js`、源码映射和许可证声明；不要只复制主脚本。图片工具与视频对话框首次使用才请求配套文件。使用 CSP 时允许对应的脚本来源。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
