# 相对网址基址

Classic/CMS 编辑器可通过 `baseHref` 设置每个实例的内容基址：

```ts
const editor = await createClassicEditor(textarea, {
    preset: cmsRuntimePreset,
    baseHref: 'https://www.example.com/assets/',
    preview: true,
});
```

也可使用 `/assets/` 这类相对于宿主页面的基址；目录地址需要保留末尾 `/`。只允许 HTTP/HTTPS。未设置时保持浏览器原有解析行为。

编辑区中的相对图片、链接、普通 srcset、poster 和内联 CSS `url(...)` 使用此基址。编辑器不会修改宿主页面的 `<base>`；实例可使用不同基址。保存的 HTML 保留相对属性。预览默认使用同一基址，可通过 `preview.baseUrl` 单独覆盖。

此选项不改变 SoFinder 上传目录、服务端存储路径或内容安全策略。

图片属性窗口读取正文原始的 `src`、`srcset` 和图片链接 `href`。预览层解析出的绝对地址不作为属性初始值，更新图片时也不会写回正文。
