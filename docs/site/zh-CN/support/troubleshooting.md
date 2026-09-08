---
title: '常见问题'
description: '排查样式、Source 加载、保存、重复工具栏和上传问题。'
---

# 常见问题

## 编辑器没有样式

确认引入 `/cms/styles.css`，检查请求是否返回 CSS 而非 404 HTML。

## Source 无法打开

确认使用 `/cms/optional`、启用 editingModes，并部署所有动态 chunk。保留内容，修复资源路径后重试。

## 保存缺少内容

读取 `getData()` 或同步的 textarea，不读取内部 contenteditable。检查字段 name 和服务端接收格式。

## 多次打开出现重复工具栏

记录实例句柄，在移除宿主前等待 destroy，检查失败路径是否也释放资源。

## 上传失败

区分文件预检、适配器拒绝和服务端失败。演示的“下次上传失败”属于模拟行为。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
