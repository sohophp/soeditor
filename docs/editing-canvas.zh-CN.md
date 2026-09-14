# 可视编辑区尺寸预设

`canvas` 为每个 Classic 编辑器实例独立配置可视编辑画布。省略 `canvas` 时保持
原有编辑区布局；传入 `{}` 时显示常用屏幕宽度以及电子报、Word 尺寸。切换不会写入
HTML，不增加撤销步骤，不影响其它实例。原有编辑器高度、拖动缩放和 Source 保持独立。

```ts
const article = await createClassicEditor(articleTextarea, {
    canvas: { initialPreset: 'webpage' },
});
const newsletter = await createClassicEditor(newsletterTextarea, {
    canvas: { initialPreset: 'email', presets: ['email', 'webpage'] },
});
const document = await createClassicEditor(documentTextarea, {
    canvas: {
        initialPreset: 'word',
        presets: ['word', { id: 'compact', label: '窄版', width: '420px', padding: '20px' }],
    },
});
article.setCanvasPreset('email');
console.log(article.canvasPreset);
```

内建尺寸：网页宽 100%、内距 24px；电子报宽 600px、内距 28px；Word 宽 210mm、
最小高度 297mm、内距 25.4mm。窄屏宽度会缩小到可用空间，保持可编辑，长内容照常
滚动；Word 是 A4 画布外观，不提供分页和 Word 文档导出。

自定义尺寸允许 px、rem、em、mm、cm、in、% 和 0。预设 ID 必须唯一，默认项必须
存在于实例的列表中。`showSelector: false` 隐藏尺寸选择器，仍可通过实例 API 切换。
自定义标签按传入内容显示；内建标签随编辑器语言切换。

画布与新窗口预览模板分别配置；调整编辑画布不修改预览模板或持久化 HTML。

## 常用屏幕宽度

| ID | 显示名称 | 宽度 |
| --- | --- | --- |
| webpage | 自适应 | 100% |
| mobile | 手机 | 390px |
| mobile-wide | 大屏手机 | 430px |
| ipad | iPad 竖屏 | 768px |
| ipad-landscape | iPad 横屏 | 1024px |
| desktop | PC | 1200px |
| macbook | Mac 笔记本 | 1280px |
| desktop-wide | 宽屏桌面 | 1440px |
| full-hd | 大屏桌面 | 1920px |

这些是常用的 CSS 画布宽度参考，不代表所有对应设备的规格，也不是设备模拟器。
设备宽度保持固定，超出编辑区时横向滚动。电子报和 Word 继续保留原有的自适应
缩小行为；自定义预设设置 `fitToContainer: false` 也可保持精确宽度。

每个实例可通过 `canvas.presets` 选用上述 ID，例如
`{ initialPreset: 'mobile', presets: ['webpage', 'mobile', 'ipad', 'desktop'] }`。

## 弹出窗口：宽度与模板独立选择

编辑区和预览窗口的尺寸选项统一显示“电子报 · 600px”和“Word · A4 210 × 297mm”。
预览窗口提供“预览模板”和“预览宽度”两个选择器。默认复用该实例的画布预设，
首次打开时使用当前编辑尺寸。之后窗口保留自己的选择，不反向修改编辑画布。
预览按真实 iframe 宽度渲染，外部 CSS 的媒体查询也使用该宽度；超宽时横向滚动。

`preview.canvas` 可独立指定预览的默认尺寸和选项；`preview.templates` 指定应用
提供的模板。每个模板支持 HTML、内嵌 CSS、外部 CSS 文件：

```ts
await createClassicEditor(textarea, {
    canvas: { initialPreset: 'mobile' },
    preview: {
        initialTemplateId: 'brand',
        canvas: { initialPreset: 'desktop', presets: ['webpage', 'mobile', 'desktop', 'email', 'word'] },
        templates: [{
            id: 'brand',
            label: '品牌网站',
            baseUrl: location.href,
            template: '<html><head><meta charset="utf-8"></head><body><main class="brand-content">{{ content }}</main></body></html>',
            stylesheets: ['/assets/brand.css', '/assets/article.css'],
            styles: ['.brand-content { padding: 24px; }'],
            wysiwygStyles: false,
        }],
    },
});
```

模板必须恰好包含一个 `{{ content }}`；CSS 文件按 `stylesheets` 数组顺序加载，
随后应用 `styles`。相对 CSS 路径需配置该模板的 `baseUrl`。使用网站自己的 CSS 时，
可设 `wysiwygStyles: false` 排除编辑器内容样式。切换模板会重建预览文档并清除上个
模板的样式，不修改保存的 HTML。完整 HTML 文档直接渲染，不再套入片段模板。

这是应用配置的模板和样式资源；正文脚本仍不可执行，不注入播放器操作区。
