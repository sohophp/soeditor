---
title: '多实例与销毁'
description: '每个编辑器独立拥有内容、历史、选择、服务和异步任务。为每个实例使用不同宿主并保存各自的句柄。'
---

# 多实例与销毁

每个编辑器独立拥有内容、历史、选择、服务和异步任务。为每个实例使用不同宿主并保存各自的句柄。

销毁时先终止应用监听器，再等待所有实例的 `destroy()`，最后移除宿主。初始化失败时也要销毁已经创建的实例，防止弹窗反复打开后留下工具栏。

[运行双实例与重建示例](/zh-CN/examples/multiple)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
