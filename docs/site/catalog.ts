export const groups = [
    {
        en: 'Get started',
        zh: '快速开始',
        pages: [
            ['guide/installation', '安装与接入', 'Installation'],
            ['guide/cdn', 'CDN 接入', 'CDN integration'],
            ['guide/mounting', '挂载与生命周期', 'Mounting and lifecycle'],
        ],
    },
    {
        en: 'CMS integration',
        zh: 'CMS 集成',
        pages: [
            ['guide/forms', '表单提交与重置', 'Forms and reset'],
            ['guide/saving', 'Ajax 保存与脏状态', 'Saving and dirty state'],
            ['guide/multiple', '多实例与销毁', 'Multiple instances'],
        ],
    },
    {
        en: 'Editing',
        zh: '编辑功能',
        pages: [
            ['guide/toolbar', '配置工具栏', 'Toolbar'],
            ['guide/text', '文本与列表', 'Text and lists'],
            ['guide/links', '链接与 CMS 标记', 'Links and CMS markers'],
            ['guide/images', '图片编辑', 'Images'],
            ['guide/tables', '表格编辑', 'Tables'],
            ['guide/paste', '粘贴内容', 'Paste'],
        ],
    },
    {
        en: 'HTML Source',
        zh: 'HTML Source',
        pages: [
            ['guide/source', '启用 HTML 源码', 'Enable HTML Source'],
            ['guide/split', '源码分屏', 'Split views'],
            ['guide/formatting', '按需格式化', 'Formatting on demand'],
        ],
    },
    {
        en: 'Assets',
        zh: '资源接入',
        pages: [
            ['guide/uploads', '上传图片', 'Upload images'],
            ['guide/picker', '资源选择器', 'Asset picker'],
            ['guide/sofinder', '接入 SoFinder', 'Connect SoFinder'],
        ],
    },
    {
        en: 'API',
        zh: 'API',
        pages: [
            ['api/configuration', '配置参考', 'Configuration'],
            ['api/methods', '实例方法', 'Instance methods'],
            ['api/events', '事件与状态', 'Events and state'],
            ['api/commands', '执行命令', 'Commands'],
            ['api/imports', '入口与类型', 'Imports and types'],
        ],
    },
    {
        en: 'Examples',
        zh: '运行示例',
        pages: [
            ['examples/basic', '最小编辑器', 'Minimal editor'],
            ['examples/form', '原生表单', 'Native form'],
            ['examples/source', 'WYSIWYG + Source', 'WYSIWYG + Source'],
            ['examples/assets', '模拟上传与选择', 'Mock upload and picker'],
            ['examples/save', '模拟 Ajax 保存', 'Mock Ajax save'],
            [
                'examples/multiple',
                '多实例与重建',
                'Multiple instances and teardown',
            ],
        ],
    },
    {
        en: 'Support',
        zh: '支持与升级',
        pages: [
            ['support/security', 'HTML 与安全', 'HTML and security'],
            [
                'support/accessibility',
                '兼容与无障碍',
                'Compatibility and accessibility',
            ],
            ['support/localization', '多语言', 'Localization'],
            ['support/troubleshooting', '常见问题', 'Troubleshooting'],
            ['support/migration', '升级指南', 'Migration'],
            ['support/changelog', '更新记录', 'Changelog'],
            [
                'support/optional',
                '可选与兼容能力',
                'Optional and compatibility features',
            ],
        ],
    },
] as const;
