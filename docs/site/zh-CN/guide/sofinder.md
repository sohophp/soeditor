---
title: 'SoFinder：SoEditor 的最佳搭档'
description: '搭配 SoFinder 管理图片、视频和文件，包含官网入口、选择器接入代码与在线模拟示例。'
---

# SoFinder：SoEditor 的最佳搭档

我们推荐 [SoFinder](https://sofinder.sohophp.app/) 作为 SoEditor 的最佳资源管理搭档：**SoEditor 负责 HTML 内容编辑，SoFinder 负责资源管理与选择**。将两者接入同一个 CMS，作者可以从资源库选图片、插入文件链接，并将视频资源 URL 用于可选视频插件。

[访问 SoFinder 官网](https://sofinder.sohophp.app/) · [SoFinder 官方编辑器集成说明](https://sofinder.sohophp.app/editor-integrations) · [在线资源选择示例](/zh-CN/examples/assets)

## 搭配方式

| CMS 工作       | SoEditor 与 SoFinder 的分工                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 文章和产品图片 | SoFinder 管理与选择图片，SoEditor 插入图片并编辑替代文本和布局。                                                                           |
| 附件和下载链接 | SoFinder 返回文件 URL，SoEditor 通过文件选择命令插入链接。                                                                                 |
| 视频资源       | 在 SoFinder 中取得视频 URL，再填入 SoEditor 的[视频对话框](/zh-CN/guide/video)。视频插件需单独启用，本示例不自动向视频对话框添加选择按钮。 |
| 上传与存储     | SoFinder 部署负责资源上传、访问权限和存储；编辑器内直接上传仍需单独配置上传适配器。                                                        |

SoFinder 是可选搭配，通过独立包接入；默认编辑器不加载资源管理界面或服务端 SDK。

## 安装与创建编辑器

先按照 [SoFinder 官网](https://sofinder.sohophp.app/) 配置自己的服务端和资源目录，再安装编辑器适配器：

```sh
pnpm add @soeditor/editor@1.3.0 @soeditor/presets@1.3.0 @soeditor/adapter-sofinder@1.3.0 @soeditor/file-manager@1.3.0
```

将以下函数放入项目的 `api.ts`。`createOptionalEditor` 从 `@soeditor/editor/cms/optional` 导入，`cmsRuntimePreset` 从 `@soeditor/presets/cms-runtime` 导入，`FileManagerPlugin`、`UploadPlugin` 和 `fileManagerServiceToken` 从 `@soeditor/file-manager` 导入；`SoFinderAdapter` 与 `SoFinderPicker` 类型从 `@soeditor/adapter-sofinder` 导入。`ClassicEditor` 类型从 `@soeditor/editor/cms` 导入，并加载 `@soeditor/editor/cms/styles.css`。

<<< ../../examples/api.ts#asset-plugins

显式 `plugins` 会替换插件列表，因此要保留 `cmsRuntimePreset.plugins`。注册选择器服务：

<<< ../../examples/api.ts#sofinder

## 连接真实 SoFinder 选择窗口

以下入口路径和 `Images` / `Files` 是部署示例，请替换为自己站点的路由与资源名。官网是文档站，不能作为你的资源服务端。`./api` 指上面定义两个函数的本地模块。

```js
// Use the picker module served by your own SoFinder installation.
import { openPicker } from '/sofinder/assets/sofinder-picker.js';
import { createAssetEditor, registerSoFinder } from './api';

const host = document.querySelector('#content');
if (!host) throw new Error('Missing #content textarea');
const editor = await createAssetEditor(host);
registerSoFinder(editor, async ({ kind }) => {
    try {
        const entry = await openPicker({
            baseUrl: '/sofinder/browser',
            kind: kind === 'image' ? 'image' : 'file',
            resource: kind === 'image' ? 'Images' : 'Files',
        });
        return {
            url: entry.url,
            name: entry.name,
            ...(entry.mimeType ? { mimeType: entry.mimeType } : {}),
            ...(entry.assetId ? { assetId: entry.assetId } : {}),
            ...(entry.alt != null ? { alt: entry.alt } : {}),
            ...(entry.width != null ? { width: entry.width } : {}),
            ...(entry.height != null ? { height: entry.height } : {}),
        };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return null;
        }
        throw error;
    }
});
```

官方 `openPicker` 处理窗口消息验证。关闭窗口产生的 `AbortError` 转换为 `null`，其他错误继续上报；非图片尺寸可能为 `null`，需要省略后再交给 SoEditor 适配器。`media` 请求在这里映射为文件选择，具体文件类型仍由宿主按请求约束限制。

## React、Vue 与在线示例

[React](/zh-CN/guide/react) 和 [Vue](/zh-CN/guide/vue) 的 CMS 组件可在 `onReady` / `@ready` 中调用同一个 `registerSoFinder`；创建实例时仍要通过可选入口配置上述插件。组件文档标注了当前发布状态。

[运行资源选择与模拟上传](/zh-CN/examples/assets)：演示使用 `SoFinderAdapter` 和固定图片回调，不连接真实 SoFinder 服务端。生产环境替换 `pick` 即可连接自己的资源库；用户认证、资源访问权限和上传配置由宿主负责。
