---
title: '事件与状态'
description: '通过创建配置的 onChange 监听规范内容变化。事件包含 source、previousSource、origin；业务保存使用 source，不解析视图 DOM。'
---

# 事件与状态

通过创建配置的 `onChange` 监听规范内容变化。事件包含 source、previousSource、origin；业务保存使用 source，不解析视图 DOM。

`onReady`、`onFocus`、`onBlur` 提供实例生命周期通知，`onError` 处理错误。保存状态通过 `save.onStateChange` 单独读取，dirty 不等于“当前网络请求失败”。

卸载宿主时取消自己注册的 DOM 监听器，编辑器销毁不会替宿主清理所有外部业务代码。

## 可运行代码

<<< ../../examples/api.ts#configuration

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
