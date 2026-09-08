---
title: '视频编辑与预览'
description: '接入可选视频插件，编辑资源并预览文章。'
---

# 视频编辑与预览

视频是显式可选功能，自 1.2.0 提供，本站示例固定使用已发布的 1.3.0。默认 CMS 编辑器不会自动启用视频；从 `@soeditor/editor/video` 导入 `createCmsVideoPlugin()`，把插件加入 `plugins`，把 `cmsVideo` 加入工具栏。

## 最小接入与文章预览

下面使用 `soeditor-release` 别名锁定发布版本。在自己的项目中可改为相同版本的 `@soeditor/editor` 导入。

```sh
pnpm add soeditor-release@npm:@soeditor/editor@1.3.0 @soeditor/presets@1.3.0
```

<<< ../../examples/video.ts

示例使用同源的短 WebM 视频，不需要视频上传服务。`preview: true` 要通过 `/cms/optional` 入口启用；“预览整篇文章”打开独立窗口。浏览器可能要求允许用户触发的弹窗。

## 编辑与保存

可在对话框输入支持的视频资源 URL 或 YouTube URL，设置标题、封面、尺寸、宽高比和对齐。选中已有视频卡片后双击或按 Enter 可编辑；Delete/Backspace 可删除。一次完成的编辑可撤销。

编辑区显示惰性视频卡片，不播放保存的 video/iframe。`getData()` 返回实际 HTML，而不是卡片 DOM。文章预览独立渲染允许的视频；播放器不会替代正文的保存数据。

显式 `plugins` 会替换默认插件列表；务必像示例一样保留 `...cmsRuntimePreset.plugins`，再追加视频插件。

## 来源策略

| 选项                  | 用途                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `allowedMediaOrigins` | 允许的额外 HTTPS 视频/封面来源，必须只写 origin，不带路径。同源资源默认允许。                   |
| `youtube`             | 可设为 `false` 禁用 YouTube；示例显式启用。                                                     |
| `youtubeMetadata`     | 可设为 `false` 禁止自动查询 YouTube 标题/封面；本站示例关闭，避免未明确操作就请求第三方元数据。 |

例如 `createCmsVideoPlugin({ allowedMediaOrigins: ['https://media.example.com'], youtube: false })` 允许自己的媒体 CDN，但不允许任意嵌入站点。开启元数据查询会请求 YouTube 服务；不要把返回的嵌入 HTML 直接注入页面。

## 常见问题

- 工具栏缺少视频按钮：同时检查插件注册和 `cmsVideo` 配置。
- 视频不播放：先确认在文章预览/前台播放，检查 URL、编码、响应 Content-Type、跨域及 CSP；编辑区卡片本身不会播放。
- 使用外部媒体或 YouTube 时，宿主需要相应的 `media-src`、`img-src`、`frame-src`，元数据查询还需要 `connect-src`。
- 上传与存储仍由宿主提供；视频按钮不是上传后端。原有 HTML 保留不代表可以在后台执行它。

[运行视频示例](/zh-CN/examples/video)

## 最佳搭档：SoFinder

[SoFinder](https://sofinder.sohophp.app/) 是我们推荐的资源管理搭档。查看[搭配说明与接入示例](/zh-CN/guide/sofinder)，了解图片、文件与视频 URL 的使用方式，以及模拟选择与真实服务端的区别。
