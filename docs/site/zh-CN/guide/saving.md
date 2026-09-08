---
title: 'Ajax 保存与脏状态'
description: "使用 /cms/optional 并配置 save.adapter.save。适配器收到 source、版本令牌和 AbortSignal，成功时返回 { status: 'saved', revisionToken }。失败时抛出错误；遇到服务端并发冲突返回 status: 'conflict'，由宿主决定如何处理。"
---

# Ajax 保存与脏状态

使用 `/cms/optional` 并配置 `save.adapter.save`。适配器收到 `source`、版本令牌和 `AbortSignal`，成功时返回 `{ status: 'saved', revisionToken }`。失败时抛出错误；遇到服务端并发冲突返回 `status: 'conflict'`，由宿主决定如何处理。

调用 `save()` 发起保存，`retrySave()` 重试。通过 `save.onStateChange` 读取 dirty 和保存状态。保存过程中发生的新编辑仍保持未保存状态，不能因为旧请求成功就清除。

自动保存为显式配置项，首期示例不启用。销毁实例会取消其保存工作。[运行失败与重试示例](/zh-CN/examples/save)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
