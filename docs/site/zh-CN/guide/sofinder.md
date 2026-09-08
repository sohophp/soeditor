---
title: '接入 SoFinder'
description: '安装 @soeditor/adapter-sofinder@1.2.1 与 @soeditor/file-manager@1.2.1。把宿主已有 SoFinder 的选择回调传入 SoFinderAdapter。'
---

# 接入 SoFinder

安装 `@soeditor/adapter-sofinder@1.2.1` 与 `@soeditor/file-manager@1.2.1`。把宿主已有 SoFinder 的选择回调传入 `SoFinderAdapter`。

桥接函数接受 FileManagerOpenOptions，返回包含 url 的 SoFinderSelection 或 null。适配器转换字段并验证结果，不创建 SoFinder 服务端或代替用户认证。

下面的 `pick` 是宿主注入接口。演示使用内置资源模拟该接口；生产时换成实际选择窗口。

## 可运行代码

<<< ../../examples/api.ts#sofinder

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 创建支持资源选择的实例

<<< ../../examples/api.ts#asset-plugins

随后调用 `registerSoFinder`。宿主负责打开真正的 SoFinder 窗口并把结果交给适配器；示例的固定图片回调没有部署 SoFinder 服务端。

## 常见错误

取消必须返回空结果，不要插入空 URL。跨域资源访问权限由宿主和资源服务器处理。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
