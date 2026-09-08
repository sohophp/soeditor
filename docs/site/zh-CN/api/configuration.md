---
title: '配置参考'
description: 'CreateClassicEditorOptions 为只读的创建配置类型。下表列出 CMS 常用字段；完整类型以安装包声明为准。'
---

# 配置参考

`CreateClassicEditorOptions` 为只读的创建配置类型。下表列出 CMS 常用字段；完整类型以安装包声明为准。

| 字段                              | 用途                     |
| --------------------------------- | ------------------------ |
| locale / translations             | 语言及宿主翻译           |
| data                              | 初始 HTML                |
| readonly                          | 初始只读状态             |
| minHeight / maxHeight             | 编辑区高度约束           |
| toolbar / toolbarLayout           | 工具栏内容与布局         |
| editingModes / initialEditingMode | 可选入口的编辑模式       |
| source                            | Source 增强配置          |
| save                              | 可选入口的宿主保存适配器 |
| onChange / onError                | 内容变更与错误回调       |

默认入口拒绝需要可选运行时的配置。不要通过类型断言绕过错误，改用正确入口。

## 可运行代码

<<< ../../examples/api.ts#configuration

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
