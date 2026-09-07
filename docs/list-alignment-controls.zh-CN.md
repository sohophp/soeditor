# CMS 对齐与列表菜单

默认 CMS 工具栏使用 `alignment` 对齐下拉菜单，提供左对齐、居中、右对齐和两端对齐。菜单图标与选中项随当前光标位置更新。自定义工具栏仍可使用原有 `alignLeft`、`alignCenter`、`alignRight`、`alignJustify`。

`orderedList` 和 `unorderedList` 使用分离的主按钮和样式箭头：主按钮切换列表，箭头打开样式网格。编号列表有数字、前导零数字、大小写罗马数字、大小写字母六种样式；符号列表有实心圆、空心圆、方块三种样式。选取样式会创建列表或更新当前列表，并形成一个撤销步骤。

对齐输出标准 `text-align`；列表样式输出标准 `list-style-type`。读取旧列表时识别 `type` 属性，修改同类列表的标记样式保留 `start`、自定义属性和嵌套内容。无需前台加载编辑器 UI 样式。切换列表类型保留项目及嵌套内容；取消列表保留每项内容。

菜单提供简体中文、繁体中文与英文标签。聚焦箭头后使用上下键打开菜单，方向键在选项间移动，Enter 应用，Escape 关闭并返回箭头。只读或多单元格选区禁止执行列表命令。

内部受控编辑服务新增可选 `setListStyle` / `isListStyleActive` 能力；未实现它们的兼容编辑引擎仍可使用原有列表主按钮，样式选项禁用。默认 CMS WYSIWYG 实现这些能力。

参考公开交互：[CKEditor 5 文本对齐](https://ckeditor.com/docs/ckeditor5/latest/features/text-alignment.html)、[列表属性](https://ckeditor.com/docs/ckeditor5/latest/features/lists/lists-properties.html)。本实现使用 SoEditor 自己的命令、事务与 DOM 控件。

## 本轮验证（2026-09-06）

完整 Chromium 浏览器回归 126 项（34.5 秒）、单元测试 403 项、集成性能测试、构建、类型检查、lint、API 报告、文档校验、打包消费者和分发审计通过。新增浏览器场景覆盖六种编号样式、列表类型切换、嵌套项目保留、`start` 与 CMS 属性保留、撤销、四种对齐、键盘菜单操作和 375px 视口边界。CMS 桌面／移动 Chromium 六项回归通过。

体积门禁未通过：本轮最终构建的独立 CMS 全局包约 152.16 kB gzip（上限 150 kB），CSS 约 28.65 kB（上限 27 kB）。预算保持不变；不能将本轮标记为发布门禁全部通过。尚未做真实 Safari 或辅助技术人工验收。

列表控件的 `data-toolbar-item` 现在位于分离按钮容器；若宿主测试直接点击该容器，应改为选择其直接子 `button`，样式菜单通过 `summary` 打开。

实际截图：[编号列表](evidence/list-alignment-2026-09-06/ordered-gallery.png)、[符号列表](evidence/list-alignment-2026-09-06/bullet-gallery.png)、[对齐菜单](evidence/list-alignment-2026-09-06/alignment-gallery.png)。

符号预览清晰度修正：使用 6px 几何圆点、空心描边圆和直角方块，避免字体中的小符号缩小后难以区分。[修正后截图](evidence/list-alignment-2026-09-06/bullet-gallery-clear.png)。专项浏览器回归通过。

格式状态补充：Classic 的标题、对齐、列表、字号、字体与颜色控件现在区分统一值、混合值和不可用状态。混合选区不会错误高亮某个值；读取 CSS 继承后的显示值，清空选区或只读时清除可编辑状态。自定义 UI 可通过 `readFormatStates` 提供格式快照。
