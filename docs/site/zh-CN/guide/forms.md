---
title: '表单提交与重置'
description: 'textarea 的 name 是提交字段名。编辑器会同步其值，并在原生提交前刷新规范 HTML。表单重置恢复 textarea 的默认内容。'
---

# 表单提交与重置

textarea 的 `name` 是提交字段名。编辑器会同步其值，并在原生提交前刷新规范 HTML。表单重置恢复 textarea 的默认内容。

在 Ajax 表单的 submit 监听器中调用 `preventDefault()`，使用 `FormData` 读取字段。演示只显示读取结果，不发送请求。浏览器必填行为与宿主验证请结合实际表单检查；服务端仍需验证字段。

[运行原生表单示例](/zh-CN/examples/form)。

## 可运行代码

<<< ../../examples/form.ts

代码通过共享的 `options` 设置语言与变化回调，`ctx.host` 是带 `name="content"` 的 textarea。完整宿主与共享代码见[原生表单示例](/zh-CN/examples/form)。

## 常见错误

缺少 `name` 的字段不会进入 `FormData`。挂载到普通元素时，没有隐式的表单字段，应在提交时用 `getData()` 写入宿主字段。重置目标来自 textarea 默认值，不是最近保存结果。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
