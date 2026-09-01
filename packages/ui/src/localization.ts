import type {
    EditorUiDirection,
    EditorUiTranslationResource,
} from './types.js';

const simplifiedChinese: Readonly<Record<string, string>> = Object.freeze({
    'Add attribute': '添加属性',
    'Additional attributes': '附加属性',
    'Added attributes': '已添加属性',
    'Add standard or CMS attributes. Reserved names are blocked.':
        '可添加标准或 CMS 属性；保留属性名会被阻止。',
    'Attribute name': '属性名',
    'Attribute value': '属性值',
    'Choose or enter an attribute name': '选择或输入属性名',
    'No additional attributes.': '暂无附加属性。',
    'Remove attribute': '移除属性',
    'Invalid attribute.': '属性无效。',
    'Accessibility help': '无障碍帮助',
    'Accessible label': '无障碍标签',
    'Align center': '居中对齐',
    'Align left': '左对齐',
    'Align right': '右对齐',
    Add: '添加',
    'Add relationship': '添加链接关系',
    'Advanced settings': '高级设置',
    Alignment: '对齐方式',
    Apply: '应用',
    Automatic: '自动',
    Baseline: '基线',
    Body: '表体',
    Bottom: '底部',
    Center: '居中',
    'Cell classes': '单元格类名',
    'Cell HTML': '单元格 HTML',
    'Cell properties': '单元格属性',
    'Changes apply to all selected cells.': '更改将应用到所有选中的单元格。',
    Custom: '自定义',
    'Custom width': '自定义宽度',
    Default: '默认',
    Column: '列',
    'Column group': '列组',
    'Edit cell HTML': '编辑单元格 HTML',
    'Edit the HTML inside this cell. Nested tables are not allowed.':
        '编辑此单元格内的 HTML，不允许嵌套表格。',
    'Enter a whole number from 1 to 100.': '请输入 1 到 100 的整数。',
    'Enter a whole number from 1 to 9999.': '请输入 1 到 9999 的整数。',
    'Horizontal alignment': '水平对齐',
    Footer: '表尾',
    Header: '表头',
    Left: '左对齐',
    Middle: '居中',
    Percent: '百分比',
    Pixels: '像素',
    Right: '右对齐',
    Row: '行',
    'Row group': '行组',
    'Row properties': '行属性',
    'Table width': '表格宽度',
    Top: '顶部',
    'Width unit': '宽度单位',
    'Alternative text': '替代文本',
    'Anchor name': '锚点名称',
    'Background color': '背景色',
    'Block quote': '块引用',
    Bold: '粗体',
    'Bold: Control or Command plus B': '粗体：Control 或 Command 加 B',
    Cancel: '取消',
    'Changes saved': '更改已保存',
    Caption: '标题',
    Character: '字符',
    'Choose a common target': '选择常用目标',
    'Choose block style': '选择段落样式',
    'Choose color': '选择颜色',
    'Choose file link': '选择文件链接',
    'Choose internal link': '选择内部链接',
    'Close preview': '关闭预览',
    'Close a dialog or menu: Escape': '关闭对话框或菜单：Escape',
    'CMS placeholder': 'CMS 占位符',
    'Collapse editor toolbar': '折叠编辑器工具栏',
    'Context menu: Shift plus F10': '上下文菜单：Shift 加 F10',
    Columns: '列数',
    'Common relationships': '常用链接关系',
    'Common target': '常用目标',
    'Color value': '颜色值',
    'Custom color': '自定义颜色',
    'Custom relationship': '自定义链接关系',
    'Custom target name': '自定义目标名称',
    'Apply color': '应用颜色',
    document: '文档',
    'Displayed text': '显示文本',
    Edit: '编辑',
    'Edit link': '编辑链接',
    'Editing view': '编辑视图',
    Embed: '嵌入内容',
    'Enter 1–9999 px (px is optional) or 1%–100%.':
        '请输入 1–9999 px（px 可省略）或 1%–100%。',
    'Editor context menu': '编辑器上下文菜单',
    'Editor notifications': '编辑器通知',
    'Editor toolbar': '编辑器工具栏',
    'Expand editor toolbar': '展开编辑器工具栏',
    'Format HTML': '格式化 HTML',
    'Format source HTML': '格式化 HTML 源码',
    'Minify source HTML': '压缩 HTML 源码',
    'Font size': '字号',
    'For example: 640, 640px, or 70%': '例如：640、640px 或 70%',
    'Header scope': '表头范围',
    Heading: '标题',
    Help: '帮助',
    Height: '高度',
    'Horizontal rule': '水平线',
    Image: '图片',
    'Image URL': '图片地址',
    Indent: '增加缩进',
    'Insert link': '插入链接',
    'Insert column after': '在后面插入列',
    'Insert row after': '在后面插入行',
    Italic: '斜体',
    'Italic: Control or Command plus I': '斜体：Control 或 Command 加 I',
    'Invalid color. Use #2563eb, rgb(37, 99, 235), hsl(217, 91%, 60%), or a color name.':
        '颜色格式不正确。请输入 #2563eb、rgb(37, 99, 235)、hsl(217, 91%, 60%) 或颜色名称。',
    Justify: '两端对齐',
    Link: '链接',
    'Link URL': '链接地址',
    Maximize: '最大化',
    'Maximize editor': '最大化编辑器',
    'Named anchor': '命名锚点',
    'New window or tab (_blank)': '新窗口或标签页（_blank）',
    'Ordered list': '有序列表',
    'Optional tooltip': '可选提示文字',
    Outdent: '减少缩进',
    'Page break': '分页符',
    Paragraph: '段落',
    'Preset colors': '预设颜色',
    'Placeholder name': '占位符名称',
    Redo: '重做',
    'Recent colors': '最近使用的颜色',
    'Same window (_self)': '当前窗口（_self）',
    Relationship: '链接关系',
    'Remove format': '清除格式',
    'Remove link': '移除链接',
    'Remove media': '移除媒体',
    'Resize editor height': '调整编辑器高度',
    'Responsive classes': '响应式类名',
    Restore: '还原',
    'Restore editor size': '还原编辑器大小',
    'Rich text editor': '富文本编辑器',
    'Row classes': '行类名',
    Rows: '行数',
    Saved: '已保存',
    Save: '保存',
    'Save conflict': '保存冲突',
    'Save failed': '保存失败',
    Saving: '正在保存',
    'Show or hide editor toolbar': '显示或隐藏编辑器工具栏',
    Source: '源码',
    'Source + Preview': '源码 + 预览',
    'Special character': '特殊字符',
    Strike: '删除线',
    Subscript: '下标',
    Superscript: '上标',
    'Switch to HTML source editing': '切换到 HTML 源码编辑',
    'Switch to Source editing': '切换到 Source 编辑',
    'Switch to visual editing': '切换到可视化编辑',
    'Switch to WYSIWYG editing': '切换到 WYSIWYG 编辑',
    Table: '表格',
    'Table cell properties': '单元格属性',
    'Table properties': '表格属性',
    'Table row properties': '表格行属性',
    Target: '目标',
    'Parent frame (_parent)': '父级框架（_parent）',
    'Top frame (_top)': '顶级框架（_top）',
    'Text color': '文字颜色',
    'Text shown to readers': '向读者显示的文字',
    Title: '标题',
    Toolbar: '工具栏',
    Underline: '下划线',
    Undo: '撤销',
    'Undo: Control or Command plus Z': '撤销：Control 或 Command 加 Z',
    'Unordered list': '无序列表',
    Unsaved: '未保存',
    'Retry save': '重试保存',
    URL: '地址',
    'Update link': '更新链接',
    'Vertical alignment': '垂直对齐',
    Visual: '可视化',
    'WYSIWYG + Preview': '所见即所得 + 预览',
    'WYSIWYG + Source': '所见即所得 + 源码',
    'WYSIWYG + Source + Preview': '所见即所得 + 源码 + 预览',
    Width: '宽度',
    'Width must be 1–9999 px or 1%–100%.': '宽度必须是 1–9999 px 或 1%–100%。',
    'Width (px or %)': '宽度（px 或 %）',
    characters: '字符',
    'source characters': '源码字符',
    words: '词',
    'Use Tab to enter controls and Arrow keys to move within toolbars and menus.':
        '使用 Tab 进入控件，并使用方向键在工具栏和菜单中移动。',
});

const traditionalChinese: Readonly<Record<string, string>> = Object.freeze({
    'Add attribute': '新增屬性',
    'Additional attributes': '附加屬性',
    'Added attributes': '已新增屬性',
    'Add standard or CMS attributes. Reserved names are blocked.':
        '可新增標準或 CMS 屬性；保留屬性名稱會被阻擋。',
    'Attribute name': '屬性名稱',
    'Attribute value': '屬性值',
    'Choose or enter an attribute name': '選擇或輸入屬性名稱',
    'No additional attributes.': '尚無附加屬性。',
    'Remove attribute': '移除屬性',
    'Invalid attribute.': '屬性無效。',
    'Accessibility help': '無障礙說明',
    'Accessible label': '無障礙標籤',
    'Align center': '置中對齊',
    'Align left': '靠左對齊',
    'Align right': '靠右對齊',
    Add: '新增',
    'Add relationship': '新增連結關係',
    'Advanced settings': '進階設定',
    Alignment: '對齊方式',
    Apply: '套用',
    Automatic: '自動',
    Baseline: '基線',
    Body: '表體',
    Bottom: '底部',
    Center: '置中',
    'Cell classes': '儲存格類別',
    'Cell HTML': '儲存格 HTML',
    'Cell properties': '儲存格屬性',
    'Changes apply to all selected cells.': '變更將套用到所有選取的儲存格。',
    Custom: '自訂',
    'Custom width': '自訂寬度',
    Default: '預設',
    Column: '欄',
    'Column group': '欄群組',
    'Edit cell HTML': '編輯儲存格 HTML',
    'Edit the HTML inside this cell. Nested tables are not allowed.':
        '編輯此儲存格內的 HTML，不允許巢狀表格。',
    'Enter a whole number from 1 to 100.': '請輸入 1 到 100 的整數。',
    'Enter a whole number from 1 to 9999.': '請輸入 1 到 9999 的整數。',
    'Horizontal alignment': '水平對齊',
    Footer: '表尾',
    Header: '表頭',
    Left: '靠左',
    Middle: '置中',
    Percent: '百分比',
    Pixels: '像素',
    Right: '靠右',
    Row: '列',
    'Row group': '列群組',
    'Row properties': '列屬性',
    'Table width': '表格寬度',
    Top: '頂端',
    'Width unit': '寬度單位',
    'Alternative text': '替代文字',
    'Anchor name': '錨點名稱',
    'Background color': '背景色',
    'Block quote': '區塊引言',
    Bold: '粗體',
    'Bold: Control or Command plus B': '粗體：Control 或 Command 加 B',
    Cancel: '取消',
    'Changes saved': '變更已儲存',
    Caption: '標題',
    Character: '字元',
    'Choose a common target': '選擇常用目標',
    'Choose block style': '選擇段落樣式',
    'Choose color': '選擇顏色',
    'Choose file link': '選擇檔案連結',
    'Choose internal link': '選擇內部連結',
    'Close preview': '關閉預覽',
    'Close a dialog or menu: Escape': '關閉對話框或選單：Escape',
    'CMS placeholder': 'CMS 佔位符',
    'Collapse editor toolbar': '收合編輯器工具列',
    'Context menu: Shift plus F10': '內容功能表：Shift 加 F10',
    Columns: '欄數',
    'Common relationships': '常用連結關係',
    'Common target': '常用目標',
    'Color value': '顏色值',
    'Custom color': '自訂顏色',
    'Custom relationship': '自訂連結關係',
    'Custom target name': '自訂目標名稱',
    'Apply color': '套用顏色',
    document: '文件',
    'Displayed text': '顯示文字',
    Edit: '編輯',
    'Edit link': '編輯連結',
    'Editing view': '編輯檢視',
    Embed: '嵌入內容',
    'Enter 1–9999 px (px is optional) or 1%–100%.':
        '請輸入 1–9999 px（px 可省略）或 1%–100%。',
    'Editor context menu': '編輯器內容功能表',
    'Editor notifications': '編輯器通知',
    'Editor toolbar': '編輯器工具列',
    'Expand editor toolbar': '展開編輯器工具列',
    'Format HTML': '格式化 HTML',
    'Format source HTML': '格式化 HTML 原始碼',
    'Minify source HTML': '壓縮 HTML 原始碼',
    'Font size': '字體大小',
    'For example: 640, 640px, or 70%': '例如：640、640px 或 70%',
    'Header scope': '表頭範圍',
    Heading: '標題',
    Help: '說明',
    Height: '高度',
    'Horizontal rule': '水平線',
    Image: '圖片',
    'Image URL': '圖片網址',
    Indent: '增加縮排',
    'Insert link': '插入連結',
    'Insert column after': '在後方插入欄',
    'Insert row after': '在後方插入列',
    Italic: '斜體',
    'Italic: Control or Command plus I': '斜體：Control 或 Command 加 I',
    'Invalid color. Use #2563eb, rgb(37, 99, 235), hsl(217, 91%, 60%), or a color name.':
        '顏色格式不正確。請輸入 #2563eb、rgb(37, 99, 235)、hsl(217, 91%, 60%) 或顏色名稱。',
    Justify: '左右對齊',
    Link: '連結',
    'Link URL': '連結網址',
    Maximize: '最大化',
    'Maximize editor': '最大化編輯器',
    'Named anchor': '命名錨點',
    'New window or tab (_blank)': '新視窗或分頁（_blank）',
    'Ordered list': '有序清單',
    'Optional tooltip': '選填提示文字',
    Outdent: '減少縮排',
    'Page break': '分頁符號',
    Paragraph: '段落',
    'Preset colors': '預設顏色',
    'Placeholder name': '佔位符名稱',
    Redo: '重做',
    'Recent colors': '最近使用的顏色',
    'Same window (_self)': '目前視窗（_self）',
    Relationship: '連結關係',
    'Remove format': '清除格式',
    'Remove link': '移除連結',
    'Remove media': '移除媒體',
    'Resize editor height': '調整編輯器高度',
    'Responsive classes': '響應式類別',
    Restore: '還原',
    'Restore editor size': '還原編輯器大小',
    'Rich text editor': 'RTF 編輯器',
    'Row classes': '列類別',
    Rows: '列數',
    Saved: '已儲存',
    Save: '儲存',
    'Save conflict': '儲存衝突',
    'Save failed': '儲存失敗',
    Saving: '正在儲存',
    'Show or hide editor toolbar': '顯示或隱藏編輯器工具列',
    Source: '原始碼',
    'Source + Preview': '原始碼 + 預覽',
    'Special character': '特殊字元',
    Strike: '刪除線',
    Subscript: '下標',
    Superscript: '上標',
    'Switch to HTML source editing': '切換到 HTML 原始碼編輯',
    'Switch to Source editing': '切換到 Source 編輯',
    'Switch to visual editing': '切換到視覺化編輯',
    'Switch to WYSIWYG editing': '切換到 WYSIWYG 編輯',
    Table: '表格',
    'Table cell properties': '儲存格屬性',
    'Table properties': '表格屬性',
    'Table row properties': '表格列屬性',
    Target: '目標',
    'Parent frame (_parent)': '父層框架（_parent）',
    'Top frame (_top)': '頂層框架（_top）',
    'Text color': '文字顏色',
    'Text shown to readers': '向讀者顯示的文字',
    Title: '標題',
    Toolbar: '工具列',
    Underline: '底線',
    Undo: '復原',
    'Undo: Control or Command plus Z': '復原：Control 或 Command 加 Z',
    'Unordered list': '無序清單',
    Unsaved: '未儲存',
    'Retry save': '重試儲存',
    URL: '網址',
    'Update link': '更新連結',
    'Vertical alignment': '垂直對齊',
    Visual: '視覺化',
    'WYSIWYG + Preview': '所見即所得 + 預覽',
    'WYSIWYG + Source': '所見即所得 + 原始碼',
    'WYSIWYG + Source + Preview': '所見即所得 + 原始碼 + 預覽',
    Width: '寬度',
    'Width must be 1–9999 px or 1%–100%.': '寬度必須是 1–9999 px 或 1%–100%。',
    'Width (px or %)': '寬度（px 或 %）',
    characters: '字元',
    'source characters': '原始碼字元',
    words: '詞',
    'Use Tab to enter controls and Arrow keys to move within toolbars and menus.':
        '使用 Tab 進入控制項，並使用方向鍵在工具列和選單中移動。',
});

/** Built-in complete baseline resources for the qualified classic chrome. */
export const builtInUiTranslations: readonly EditorUiTranslationResource[] =
    Object.freeze([
        Object.freeze({ direction: 'ltr', locale: 'en', messages: {} }),
        Object.freeze({
            direction: 'ltr',
            locale: 'zh-CN',
            messages: simplifiedChinese,
        }),
        Object.freeze({
            direction: 'ltr',
            locale: 'zh-TW',
            messages: traditionalChinese,
        }),
    ]);

export interface ResolvedUiTranslation {
    readonly direction: EditorUiDirection;
    readonly locale: string;
    translate(message: string): string;
}

export function resolveUiTranslation(
    requestedLocale = 'en',
    resources: readonly EditorUiTranslationResource[] = [],
    requestedDirection?: EditorUiDirection,
): ResolvedUiTranslation {
    const locale = normalizeLocale(requestedLocale);
    const available = [...builtInUiTranslations, ...resources];
    for (const resource of available) validateResource(resource);
    if (
        requestedDirection !== undefined &&
        requestedDirection !== 'ltr' &&
        requestedDirection !== 'rtl'
    ) {
        throw new TypeError('Editor UI direction must be ltr or rtl.');
    }
    const baseLocale = locale.split('-')[0] ?? locale;
    const matchedLocale = [locale, baseLocale, 'en'].find((candidate) =>
        available.some(
            (resource) => normalizeLocale(resource.locale) === candidate,
        ),
    );
    const matches = available.filter(
        (resource) => normalizeLocale(resource.locale) === matchedLocale,
    );
    const messages = Object.assign(
        {},
        ...matches.map(({ messages }) => messages),
    );
    const direction =
        requestedDirection ??
        matches.at(-1)?.direction ??
        inferDirection(locale);
    return Object.freeze({
        direction,
        locale,
        translate: (message: string) => messages[message] ?? message,
    });
}

function validateResource(resource: EditorUiTranslationResource): void {
    if (typeof resource !== 'object' || resource === null) {
        throw new TypeError(
            'An editor UI translation resource must be an object.',
        );
    }
    normalizeLocale(resource.locale);
    if (
        resource.direction !== undefined &&
        resource.direction !== 'ltr' &&
        resource.direction !== 'rtl'
    ) {
        throw new TypeError(
            'Translation resource direction must be ltr or rtl.',
        );
    }
    if (
        typeof resource.messages !== 'object' ||
        resource.messages === null ||
        Array.isArray(resource.messages)
    ) {
        throw new TypeError('Translation resource messages must be an object.');
    }
    for (const [key, value] of Object.entries(resource.messages)) {
        if (key.length === 0 || typeof value !== 'string') {
            throw new TypeError(
                'Translation resource messages require non-empty string keys and string values.',
            );
        }
    }
}

function normalizeLocale(locale: string): string {
    if (typeof locale !== 'string' || locale.trim().length === 0) {
        throw new TypeError('Editor UI locale must not be empty.');
    }
    const normalized = locale.trim().replaceAll('_', '-').toLowerCase();
    if (
        normalized === 'zh' ||
        normalized.startsWith('zh-cn') ||
        normalized.startsWith('zh-hans')
    ) {
        return 'zh-CN';
    }
    if (
        normalized.startsWith('zh-tw') ||
        normalized.startsWith('zh-hk') ||
        normalized.startsWith('zh-hant')
    ) {
        return 'zh-TW';
    }
    return normalized === 'en' || normalized.startsWith('en-')
        ? 'en'
        : locale.trim();
}

function inferDirection(locale: string): EditorUiDirection {
    return /^(?:ar|fa|he|ur)(?:-|$)/iu.test(locale) ? 'rtl' : 'ltr';
}
