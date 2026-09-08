---
title: '实例方法'
description: 'createClassicEditor() 返回的 ClassicEditor 是 CMS 应用主要操作界面。'
---

# 实例方法

`createClassicEditor()` 返回的 ClassicEditor 是 CMS 应用主要操作界面。

| 方法                   | 返回与行为                        |
| ---------------------- | --------------------------------- |
| getData()              | string，规范 HTML                 |
| setData(source)        | 更新规范内容                      |
| focus()                | 返回编辑区焦点                    |
| setReadonly(value)     | 改变只读状态                      |
| setWorkspaceView(view) | void 或 Promise，调用时统一 await |
| save() / retrySave()   | Promise，需配置保存适配器         |
| destroy()              | Promise，释放实例资源             |

销毁后不能继续操作实例。低层命令与服务通过 `classic.editor` 的公开接口访问，不读取私有字段。

## 可运行代码

<<< ../../examples/api.ts#lifecycle

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
