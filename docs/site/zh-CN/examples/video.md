---
title: '视频与文章预览示例'
description: '运行视频编辑、HTML 保存和独立文章预览。'
---

# 视频与文章预览示例

<EditorDemo example="video" />

## 体验步骤

1. 查看初始视频卡片：编辑区不会下载或播放 WebM。
2. 双击卡片或按 Enter 修改标题与尺寸；也可点击“编辑视频”插入新视频。填写本站同源地址 `/demo-video.webm`。
3. 点击“读取 HTML”检查 video 标签；切换 Source 后能看到相同内容，卡片 UI 不应进入保存数据。
4. 点击“预览整篇文章”，在弹出的预览窗口点击播放。示例视频无音轨，仅用于验证播放。
5. 关闭预览，点击“重建示例”检查生命周期。

## 下载与完整代码

[下载发布版示例源码](/downloads/soeditor-examples-1.2.1.tar.gz)，解压执行 `pnpm install`、`pnpm dev`，打开 `video.html`。下载包含同源 `public/demo-video.webm`，不会上传编辑内容。

<<< ../../examples/video.ts

<details>
<summary>Shared lifecycle / 共享生命周期</summary>

<<< ../../examples/shared.ts

<<< ../../examples/runner.ts

<<< ../../examples/video.html

</details>

[视频接入说明](/zh-CN/guide/video)
