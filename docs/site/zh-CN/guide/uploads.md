---
title: '上传图片'
description: '安装相同版本的 @soeditor/file-manager@1.3.0，在每个实例上注册 uploadServiceToken。create(request) 返回包含 result、cancel 和 subscribe 的上传任务。'
---

# 上传图片

安装相同版本的 `@soeditor/file-manager@1.3.0`，在每个实例上注册 `uploadServiceToken`。`create(request)` 返回包含 result、cancel 和 subscribe 的上传任务。

result 成功时返回安全 URL 与图片元数据，失败时拒绝 Promise；cancel 应取消实际网络请求。通过 subscribe 向编辑器提供进度。

默认客户端单文件限制 25 MB，并发默认 4。服务端仍负责身份、文件类型、大小和存储权限验证。示例不传输所选文件，成功时返回本站内置图片。[运行上传示例](/zh-CN/examples/assets)。

## 插件与适配器

1.3.0 的外部资源插件使用 `/cms/optional`，原因见[入口限制说明](/zh-CN/api/imports)。

```sh
pnpm add @soeditor/file-manager@1.3.0 @soeditor/presets@1.3.0
```

为实例保留 CMS 插件并显式添加上传和资源插件，然后注册服务。只注册服务不会注册 `image.upload` 命令。

<<< ../../examples/api.ts#asset-plugins

[完整上传实现](/zh-CN/examples/assets)同时展示任务、取消、失败重试和输出 HTML。成功时插入资源 URL；失败时保留原有正文，允许重试。

## 常见错误

“命令未注册”时检查 `UploadPlugin`；上传一直等待时检查 `result` 是否完成；离开页面时应取消请求并销毁实例。模拟适配器不是可用于生产的存储服务。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)

## 最佳搭档：SoFinder

[SoFinder](https://sofinder.sohophp.app/) 是我们推荐的资源管理搭档。查看[搭配说明与接入示例](/zh-CN/guide/sofinder)，了解图片、文件与视频 URL 的使用方式，以及模拟选择与真实服务端的区别。
