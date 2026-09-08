---
title: '粘贴内容'
description: '外部粘贴会执行语义清理，包括常见网页和 Office 内容。纯文本粘贴用于只保留文字的工作流。'
---

# 粘贴内容

外部粘贴会执行语义清理，包括常见网页和 Office 内容。纯文本粘贴用于只保留文字的工作流。

已经存储的 CMS HTML 使用 `setData()` 加载，不应通过外部粘贴清理流程重新处理。未知、无效和不安全 HTML 是不同状态，不能统一删除。

带图片的粘贴需要上传适配器。测试宿主常用的 Word、电子表格和浏览器来源；自动化测试不能证明所有 Office 版本一致。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
