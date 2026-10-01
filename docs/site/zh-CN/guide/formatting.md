---
title: '按需格式化'
description: '格式化是独立的增强需求。打开 Source 不应自动下载 Prettier；明确调用格式化命令时才加载相应工具。'
---

# 按需格式化

格式化是独立的增强需求。打开 Source 不应自动下载 Prettier；明确调用格式化命令时才加载相应工具。

格式化只调整缩进与属性排版，保留原有属性引号、实体、正文空白、注释及内嵌脚本/CSS。行内文本边界、代码块和显式保留空白的内容不会被重写。压缩直接删除源码中的结构缩进与标签内冗余空白，不重新序列化标签或属性。两种操作都支持撤销。自动格式化需明确配置 `source.autoFormat`，不默认开启。

## 可运行代码

<<< ../../examples/api.ts#formatting

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
