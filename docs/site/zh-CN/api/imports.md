---
title: '入口与类型'
description: '普通 CMS 使用 @soeditor/editor/cms；Source、预览和保存适配器使用 /cms/optional。样式单独引入 /cms/styles.css。'
---

# 入口与类型

普通 CMS 使用 `@soeditor/editor/cms`；Source、预览和保存适配器使用 `/cms/optional`。样式单独引入 `/cms/styles.css`。

```ts
import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from '@soeditor/editor/cms';
```

`@soeditor/file-manager` 与 `@soeditor/adapter-sofinder` 是显式资源集成入口。发布包中的文件存在不等于公开 API，不深层导入 src 或内部 dist 文件。

本站发布版示例源码通过 `soeditor-release` npm 别名锁定发布版，以避免 monorepo 自动链接开发源码。普通应用使用原包名即可。

## 1.3.0 的外部资源插件

组合 `@soeditor/presets` 与单独导入的资源插件时，使用 `/cms/optional`。预打包的 `/cms` 入口与外部 UI 插件可能产生不同的注册表身份，报出 “UI registry storage is unavailable.”。此类接入使用模块化可选入口，但不启用 Source、预览或保存。普通 textarea、表单和多实例示例仍使用 `/cms`。

## 框架组件与视频

| 入口                     | 状态与说明                                      |
| ------------------------ | ----------------------------------------------- |
| `@soeditor/editor/video` | 已发布；`createCmsVideoPlugin()` 启用可选视频。 |
| `@soeditor/react/cms`    | 1.3.0 CMS 组件；使用 `value/onChange`。         |
| `@soeditor/vue/cms`      | 1.3.0 CMS 组件；支持 `v-model`。                |

[React 指南](/zh-CN/guide/react) · [Vue 指南](/zh-CN/guide/vue) · [视频指南](/zh-CN/guide/video)。框架示例使用 npm 1.3.0 发布包。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
