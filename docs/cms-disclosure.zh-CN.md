# CMS 编辑器独立折叠

`@soeditor/editor/cms/disclosure` 是可选轻量入口，不导入编辑器运行时。
每个语言的容器分别调用 `createClassicEditorDisclosure`，传入该容器的
`content` 和 `editors`。实例以容器为键，重复调用返回原实例。
如显式传入多个编辑器，仍保留旧 API 的分组折叠行为。

控制条采用原生 `details > summary`，展开与收起都保留在正常文档流中，
不插入工具栏、不查询第一个就绪编辑器、不使用全局 MutationObserver。
Enter/Space 可操作；原生控件负责展开状态和键盘语义。

- `expanded` 决定初始状态；宿主根据可见性实现延迟初始化。
- `expand()` 仅展开本实例，适用于校验错误。
- `refresh()` 更新当前内容提示；输入和切换状态时也自动更新。
- 收起只隐藏，不销毁编辑器或改写 textarea；保存同步仍由编辑器负责。
- `destroy()` 解除折叠包装及监听，保留原内容和随后挂载的编辑器节点；
  宿主仍负责编辑器实例本身的销毁。

不再提供依赖就绪状态的浮动收起按钮，也不为工具栏添加左侧占位。
宿主应移除针对 `.soeditor-disclosure__collapse` 的位置修补样式。
Winstar 的多语言集成回归覆盖三个语言乱序初始化、独立折叠、键盘操作、
宽度变化、节点身份及表单值保留；真实后台登录会话验收另行进行。

## 本地验证（2026-09-15）

- Winstar 多语言 Playwright Chromium：29 项通过（34.6 秒）。
- SoEditor 包类型检查、针对修改文件的 ESLint/Prettier、7 项现有单元测试及包构建通过。
- Winstar TypeScript、生产构建及 Solutions 迁移契约测试通过（6 项、36 个断言）。
- disclosure 独立产物：JS 2,445 字节、CSS 829 字节；不创建全局观察器，
  不加载编辑器运行时，也不重新创建已有编辑器。
- 尚未验证真实登录后台、Firefox/WebKit、真实 Safari 或辅助技术。
