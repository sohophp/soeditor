---
title: '按需格式化'
description: '格式化是独立的增强需求。打开 Source 不应自动下载 Prettier；明确调用格式化命令时才加载相应工具。'
---

# 按需格式化

格式化是独立的增强需求。打开 Source 不应自动下载 Prettier；明确调用格式化命令时才加载相应工具。

格式化可能改变空白与序列化写法，但不应删除有意义的 CMS HTML。执行后检查内容并使用撤销恢复。自动格式化需明确配置 `source.autoFormat`，不默认开启。

## 可运行代码

<<< ../../examples/api.ts#formatting

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
