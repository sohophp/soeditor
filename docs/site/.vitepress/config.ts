import { defineConfig, type DefaultTheme } from 'vitepress';
import { groups } from '../catalog.js';
import { tokenize } from './search.js';

const origin = 'https://soeditor.sohophp.app';
const workspacePreview = process.env.DOCS_WORKSPACE_PREVIEW === '1';
const preview = process.env.DOCS_PREVIEW === '1' || workspacePreview;
function theme(locale: 'zh-CN' | 'en'): DefaultTheme.Config {
    const zh = locale === 'zh-CN';
    return {
        nav: [
            {
                text: zh ? '指南' : 'Guide',
                link: `/${locale}/guide/installation`,
            },
            {
                text: zh ? '示例' : 'Examples',
                link: `/${locale}/examples/basic`,
            },
            { text: 'API', link: `/${locale}/api/configuration` },
            { text: 'SoFinder', link: 'https://sofinder.sohophp.app/' },
            {
                text: zh ? '更新记录' : 'Changelog',
                link: `/${locale}/support/changelog`,
            },
        ],
        sidebar: groups.map((group) => ({
            text: zh ? group.zh : group.en,
            items: group.pages.map(([path, cn, en]) => ({
                text: zh ? cn : en,
                link: `/${locale}/${path}`,
            })),
        })),
        outline: { label: zh ? '本页目录' : 'On this page', level: [2, 3] },
        docFooter: {
            prev: zh ? '上一篇' : 'Previous',
            next: zh ? '下一篇' : 'Next',
        },
        editLink: {
            pattern:
                'https://github.com/sohophp/soeditor/edit/master/docs/site/:path',
            text: zh ? '编辑此页' : 'Edit this page',
        },
        lastUpdated: { text: zh ? '最后更新' : 'Last updated' },
        langMenuLabel: zh ? '切换语言' : 'Language',
        darkModeSwitchLabel: zh ? '外观' : 'Appearance',
        sidebarMenuLabel: zh ? '目录' : 'Menu',
        returnToTopLabel: zh ? '返回顶部' : 'Return to top',
        skipToContentLabel: zh ? '跳至正文' : 'Skip to content',
        footer: {
            message: zh
                ? '面向网站 CMS 的 HTML 编辑器 · MIT'
                : 'HTML editing for website CMS · MIT',
            copyright: 'SoEditor 1.3.0',
        },
    };
}
export default defineConfig({
    vite: {
        define: {
            'import.meta.env.VITE_WORKSPACE_DOCS_PREVIEW': JSON.stringify(
                workspacePreview ? '1' : '0',
            ),
        },
    },
    title: 'SoEditor',
    description: 'Lightweight HTML WYSIWYG + Source editor for website CMS.',
    cleanUrls: true,
    lastUpdated: true,
    srcExclude: ['scripts/**', 'examples/**', 'tests/**'],
    head: [
        ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ],
    locales: {
        'zh-CN': {
            label: '简体中文',
            lang: 'zh-CN',
            title: 'SoEditor',
            description: '面向网站 CMS 的轻量 HTML WYSIWYG + Source 编辑器。',
            themeConfig: theme('zh-CN'),
        },
        en: { label: 'English', lang: 'en', themeConfig: theme('en') },
    },
    ...(preview
        ? {}
        : {
              sitemap: {
                  hostname: origin,
                  transformItems: (items: { url: string }[]) =>
                      items.filter((item) => /^(zh-CN|en)\//.test(item.url)),
              },
          }),
    themeConfig: {
        logo: '/favicon.svg',
        socialLinks: [
            { icon: 'github', link: 'https://github.com/sohophp/soeditor' },
        ],
        search: {
            provider: 'local',
            options: {
                miniSearch: {
                    options: { tokenize },
                    searchOptions: { prefix: true, fuzzy: 0.15 },
                },
                locales: {
                    'zh-CN': {
                        translations: {
                            button: {
                                buttonText: '搜索文档',
                                buttonAriaLabel: '搜索文档',
                            },
                            modal: {
                                noResultsText: '没有找到结果',
                                resetButtonTitle: '清除搜索',
                                displayDetails: '显示详情',
                                footer: {
                                    selectText: '选择',
                                    navigateText: '切换',
                                    closeText: '关闭',
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    transformHead({ pageData }) {
        const path = pageData.relativePath
            .replace(/index\.md$/, '')
            .replace(/\.md$/, '');
        if (!/^(zh-CN|en)\//.test(path))
            return [['meta', { name: 'robots', content: 'noindex' }]];
        const suffix = path.replace(/^(zh-CN|en)\//, '');
        return [
            ['link', { rel: 'canonical', href: `${origin}/${path}` }],
            ...['zh-CN', 'en'].map(
                (locale): ['link', Record<string, string>] => [
                    'link',
                    {
                        rel: 'alternate',
                        hreflang: locale,
                        href: `${origin}/${locale}/${suffix}`,
                    },
                ],
            ),
            [
                'meta',
                {
                    property: 'og:title',
                    content: `${pageData.title} | SoEditor`,
                },
            ],
            [
                'meta',
                { property: 'og:description', content: pageData.description },
            ],
            ['meta', { property: 'og:url', content: `${origin}/${path}` }],
            ['meta', { property: 'og:type', content: 'website' }],
            ['meta', { name: 'twitter:card', content: 'summary' }],
            ...(preview
                ? [
                      [
                          'meta',
                          { name: 'robots', content: 'noindex, nofollow' },
                      ] as ['meta', Record<string, string>],
                  ]
                : []),
        ];
    },
});
