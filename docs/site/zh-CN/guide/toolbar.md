---
title: '配置工具栏'
description: '默认工具栏覆盖普通 CMS 编辑。先从默认配置开始，用 toolbarLayout 配置折叠、换行和粘性定位；只有实际工作流需要时才定制项目。'
---

# 配置工具栏

默认工具栏覆盖普通 CMS 编辑。先从默认配置开始，用 `toolbarLayout` 配置折叠、换行和粘性定位；只有实际工作流需要时才定制项目。

工具栏显示不等于模块按需加载。Source、保存和预览需要正确的可选入口及配置。不要把隐藏按钮当作运行时隔离。

自定义布局后检查键盘焦点顺序、窄屏溢出及当前格式值。

## 可运行代码

<<< ../../examples/api.ts#configuration

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
