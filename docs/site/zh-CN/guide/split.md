---
title: '源码分屏'
description: '上下和左右分屏同时显示同一份规范 HTML 的两个编辑视图，共用历史。先配置 Source，再调用相应视图切换方法。'
---

# 源码分屏

上下和左右分屏同时显示同一份规范 HTML 的两个编辑视图，共用历史。先配置 Source，再调用相应视图切换方法。

在窄屏上优先使用上下分屏。分屏不是两个独立内容副本，保存仍然只调用同一实例的 `getData()`。

离开分屏可以切回 `wysiwyg`；第二次进入复用已加载的 Source。

## 可运行代码

<<< ../../examples/api.ts#split

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
