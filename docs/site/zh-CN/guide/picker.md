---
title: '资源选择器'
description: '资源选择器实现 FileManager.open(options)。返回一项带安全 URL 的资源，取消时返回 null。选择器由 CMS 宿主拥有，不应嵌入编辑器核心。'
---

# 资源选择器

资源选择器实现 `FileManager.open(options)`。返回一项带安全 URL 的资源，取消时返回 null。选择器由 CMS 宿主拥有，不应嵌入编辑器核心。

使用 `fileManagerServiceToken` 按实例注册。随后通过编辑器图片选择按钮或 `media.browse` 命令启动选择流程；结果由命令写入内容。

上传和选择已有资源是独立能力，可以接到不同服务。

## 可运行代码

<<< ../../examples/api.ts#picker

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 启用资源命令

<<< ../../examples/api.ts#asset-plugins

在创建实例时添加 `FileManagerPlugin`，再执行下面的服务注册。取消选择返回 `null`，正文应保持不变。

## 常见错误

只有服务、没有插件时 `media.browse` 不存在。选择器必须返回可访问的资源 URL，不能返回宿主机器的本地文件路径。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)

## 最佳搭档：SoFinder

[SoFinder](https://sofinder.sohophp.app/) 是我们推荐的资源管理搭档。查看[搭配说明与接入示例](/zh-CN/guide/sofinder)，了解图片、文件与视频 URL 的使用方式，以及模拟选择与真实服务端的区别。
