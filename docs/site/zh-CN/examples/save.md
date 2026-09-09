---
title: 模拟 Ajax 保存
description: 修改内容后保存，模拟失败，再重试并检查未保存状态。
---

# 模拟 Ajax 保存

修改内容后保存，模拟失败，再重试并检查未保存状态。

<EditorDemo example="save" />

## 如何验证

修改内容后保存，模拟失败，再重试并检查未保存状态。 “读取 HTML”显示规范内容，“重建示例”销毁并重新挂载实例。上传与保存不发送编辑内容，上传成功返回内置图片。

## 完整接入代码

[下载完整示例源码](/downloads/soeditor-examples-1.4.0.tar.gz)。解压后执行 `pnpm install`、`pnpm dev`，打开对应的 `basic.html` 等页面。

以下代码与演示共用。使用 Vite TypeScript 页面，保留相同文件结构；别名用于固定 npm 发布包。

```sh
pnpm add soeditor-release@npm:@soeditor/editor@1.4.0 @soeditor/file-manager@1.4.0 @soeditor/adapter-sofinder@1.4.0 @soeditor/presets@1.4.0
```

<<< ../../examples/save.ts

<details>
<summary>共享上下文与生命周期</summary>

<<< ../../examples/shared.ts

</details>

<details>
<summary>页面挂载与重建</summary>

<<< ../../examples/runner.ts

</details>

<details>
<summary>HTML / CSS</summary>

<<< ../../examples/save.html

<<< ../../examples/style.css

</details>

## 配置与排错

所有实例都在创建时传入 locale。结束体验会移除 iframe；重新开始使用初始内容。若样式或 Source 丢失，检查是否部署了全部构建资源。

[API](/zh-CN/api/methods) · [常见问题](/zh-CN/support/troubleshooting)
