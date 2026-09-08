---
title: '挂载与生命周期'
description: 'createClassicEditor(host, options) 接受 textarea 或 HTMLElement，并返回 Promise。等待创建结束后再读取实例。textarea 适合原生表单；普通元素由应用负责保存。'
---

# 挂载与生命周期

`createClassicEditor(host, options)` 接受 textarea 或 HTMLElement，并返回 Promise。等待创建结束后再读取实例。textarea 适合原生表单；普通元素由应用负责保存。

同一宿主不能重复挂载。动态表单或弹窗应在移除元素之前等待 `destroy()`。`setData()` 接收已存储 HTML，`getData()` 返回规范内容，不要读取编辑区域 DOM 来保存。

## 可运行代码

<<< ../../examples/api.ts#lifecycle

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
