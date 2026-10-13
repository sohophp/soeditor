# 图片、文件与站内链接接入

本文对应当前源码的 **Unreleased** 接口；已发布的 1.5.0 尚不包含新增的 `./browser`、`./ckfinder` 与 `./links` 入口。CoreRepo 开发环境通过本地 pnpm 补丁使用这些接口，不能直接把示例套到未打补丁的 1.5.0。

## 用户入口

默认工具栏使用 `image-actions`：从电脑上传、从文件管理器插入、通过网址插入。链接工具 `link` 支持网址、文件管理器选择和输入 `/` 搜索站内页面。图片属性中的链接网址也提供文件选择和相同的站内搜索。

文件选择只回填弹窗。取消链接或图片属性弹窗不会修改正文；确认后通过编辑命令保存，可撤销／重做。文件管理器内执行的上传、删除等操作属于独立资源服务，不随编辑器取消或 Undo 回滚。

底部状态栏在宽屏、窄屏及上传期间均保持单行固定高度。长文件名省略显示，悬停可查看完整状态，取消／重试／关闭按钮保持可见；多个上传任务可横向滚动，Tab 聚焦按钮时对应任务自动进入可视范围。上传成功后提示自动消失，不保留「关闭」按钮；上传中保留取消、失败保留重试，已取消提示可关闭。这些提示操作不会修改正文或删除已上传文件。宿主使用标准 CMS 样式即可，无需另写布局。

`image-browse`、`image-upload`、`file-link` 继续兼容，但仅在宿主显式加入 toolbar 时出现，不需要追加到默认工具栏。

## 创建编辑器并注册服务

```ts
import { createClassicEditor } from '@soeditor/editor/cms/optional';
import { cmsRuntimePreset } from '@soeditor/presets/cms-runtime';
import {
    FileManagerPlugin,
    UploadPlugin,
    fileManagerServiceToken,
    uploadServiceToken,
    linkTargetProviderServiceToken,
    createFileManagerLinkTargetProvider,
    createHttpLinkTargetSearch,
} from '@soeditor/file-manager';
import { createSoFinderBrowserAdapters } from '@soeditor/adapter-sofinder/browser';
import '@soeditor/editor/cms/styles.css';

const adapters = createSoFinderBrowserAdapters({
    baseUrl: '/my-site/sofinder', // 站点同源网关，非文档站地址
    csrfToken: () => currentCsrfToken,
    language: 'zh-CN',
    imageResource: 'Images',
    fileResource: 'Files',
});
const editor = await createClassicEditor(textarea, {
    locale: 'zh-CN',
    plugins: [...cmsRuntimePreset.plugins, FileManagerPlugin, UploadPlugin],
    toolbar: [...cmsRuntimePreset.toolbar],
});
editor.editor.services.register(fileManagerServiceToken, adapters.fileManager);
editor.editor.services.register(uploadServiceToken, adapters.upload);
editor.editor.services.register(
    linkTargetProviderServiceToken,
    createFileManagerLinkTargetProvider({
        fileManager: adapters.fileManager,
        searchInternal: createHttpLinkTargetSearch({
            endpoint: '/my-site/newadmin/EditorLinks/search',
        }),
    }),
);
```

`currentCsrfToken`、`textarea` 由宿主提供。`searchInternal` 可省略：不提供就没有站内搜索。仅注册 `fileManagerServiceToken` 时，`FileManagerPlugin` 的 `link.file.select` 也会自动为链接／图片链接提供文件按钮；显式的 `linkTargetProviderServiceToken` 优先，原有自定义页面搜索与 URL 映射不会被覆盖。

## SoFinder 浏览器适配器

`createSoFinderBrowserAdapters(options)` 返回 `{ fileManager, upload }`。不会在创建时加载 SoFinder SDK，第一次选择／上传时分别加载 `baseUrl/assets/sofinder-picker.js`、`baseUrl/assets/sofinder-sdk.js`。选择器使用 `baseUrl/browser`，上传使用 `baseUrl/api`。

| 参数                             | 说明                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `baseUrl`                        | 必填，HTTP(S) URL 或站点相对路径。登录 Cookie 场景建议使用同源网关；跨源部署自行满足认证、CORS 和 SDK 来源校验。 |
| `csrfToken`                      | 必填，字符串或返回当前令牌的函数；上传前读取，空令牌拒绝上传。                                                   |
| `language`                       | 可选，传给 SoFinder。                                                                                            |
| `imageResource` / `fileResource` | 默认 `Images` / `Files`；锁定当前用途，服务器仍必须检查真实权限和文件类型。                                      |
| `uploadPath`                     | 默认空字符串，资源内的上传目录。                                                                                 |
| `loadModule(url)`                | 可选，替换动态模块加载器，适用于构建器、CSP 或测试。返回官方模块。                                               |

选择器采用完整管理工具，因此链接中的文件选择也可先上传文件再选择。直接从电脑上传图片由 `upload` 服务处理，沿用 SDK 分块上传与改名冲突策略。取消选择返回 null，上传取消产生 `AbortError`；失败不会自动切到另一个提供者。适配器保留 SoFinder 返回的原文件 URL、名称、类型、尺寸及可用的响应式信息，不创建项目专用路径规则。

## CKFinder 备用适配器

```ts
import { createCKFinderBrowserAdapters } from '@soeditor/file-manager/ckfinder';
const adapters = createCKFinderBrowserAdapters({
    scriptUrl: '/resources/ckfinder/ckfinder.js',
    connectorUrl:
        '/my-site/resources/ckfinder/core/connector/php/connector.php',
    imageResource: 'Images',
    fileResource: 'Files',
});
// 按前面方式注册 adapters.fileManager / adapters.upload / 链接提供者。
```

CKFinder SDK 按需加载，关闭弹窗返回 null，上传通过原同源 QuickUpload 连接器与 `ckCsrfToken` Cookie／表单验证。`csrfCookieName` 可改变读取的 Cookie 名（发送的表单字段仍遵循 CKFinder 协议）；`loadSdk()` 可注入 SDK。服务端、许可证、登录、权限和资源限制继续由 CKFinder 部署负责。

用户切换 CKFinder／SoFinder 时由宿主选择以上一个适配器。保存当前页面后重新打开编辑器以应用新的实例配置。

## 站内链接数据接口

`createHttpLinkTargetSearch({ endpoint, fetch? })` 返回 `searchInternal(query)`；仅接受 `/` 开头、最多 100 字符的查询，拒绝 `//`。发送同源 GET `?q=/关键词`，携带同源 Cookie、`Accept: application/json`；响应必须是：

```json
{ "targets": [{ "href": "/my-site/about", "title": "关于我们" }] }
```

最多使用前 50 项。`href` 必须以单个 `/` 开头、无控制字符／反斜线、最多 2048 字符；标题非空且最多 512 字符。服务端必须重新验证登录状态、账号启用状态、站点归属和可见范围，返回 JSON 并设置 `Cache-Control: private, no-store`。建议仅查询已发布的公开页面，不暴露后台私有数据。建议标题用普通字符串；编辑器通过 textContent 渲染。

宿主也可提供自己的 `searchInternal(query)` 返回 Promise 数组，复用编辑器的延迟搜索、过期结果忽略、方向键／Enter／Escape 和弹窗生命周期管理。不能据前端校验代替服务端授权。

## 自定义 URL 发布与低层接口

`createFileManagerLinkTargetProvider({ fileManager, searchInternal?, resolveFile? })` 默认把文件 `url` 原样转为 `href`，`name` 用作标题；`resolveFile(file)` 可返回 `{ href, title? }` 或 Promise，用于宿主确有自己的公开下载页面时。选择和异步 URL 发布期间不允许再次开启该提供者。

`FileManagerPlugin` 提供：`image.browse` 插入图片、`media.browse` 插入媒体、兼容 `link.file.browse` 直接设置链接、`link.file.select` **仅返回**链接目标。后者无参数，受只读／可编辑命令和待处理选择状态限制；销毁后的结果不会修改文档。

已有 `SoFinderAdapter({ pick })`、`SoFinderUploadAdapter({ upload })` 和自定义 `FileManager`／`UploadService` 接口继续可用。第三方自定义弹窗可以按需从 `@soeditor/ui/links` 导入 `resolveLinkTargetProvider(editor)` 与 `attachLinkTargetControls(options)`；`attachLinkTargetControls` 返回销毁函数，必须在弹窗关闭时调用。

## 项目边界与验证

SoEditor 负责工具栏、弹窗、选择回填、键盘操作、HTML 命令、历史、通用 SDK 适配；SoFinder 负责存储、类型支持、上传限制、选择消息和管理功能；宿主负责站点配置、会话、即时权限检查和自己的页面数据。CoreRepo 不应复制 SDK 加载、上传任务或弹窗逻辑；SoFinder 不应依赖 CoreRepo 类或数据库。

本轮验证记录见根 CHANGELOG 的 Unreleased；本地合成浏览器回归不等于真实后台登录或 Windows 人工验收。

### SoFinder 脚本加载失败

默认浏览器加载器继续按需加载并保留成功的模块。加载失败后，下次用户操作使用 `soeditorRetry` 查询参数避开浏览器记住的失败；仅失败时做一次 HTTP 状态探测，区分 401（重新登录）、403（身份验证或权限）及临时资源错误。提示按 `language` 的英文／简体／繁体显示。重新登录前请保存当前编辑内容；适配器不会自动刷新编辑页或放宽服务端授权。自定义 `loadModule` 继续自行负责加载与重试。
