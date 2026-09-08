import DefaultTheme from 'vitepress/theme';
import { defineComponent, h } from 'vue';
import { useData, useRoute } from 'vitepress';
import type { Theme } from 'vitepress';
import Demo from './Demo.vue';
import './style.css';
export default {
    extends: DefaultTheme,
    Layout: defineComponent({
        setup() {
            const { lang } = useData();
            const route = useRoute();
            return () =>
                h(DefaultTheme.Layout, null, {
                    'home-hero-after': () => h(Demo),
                    'doc-before': () =>
                        h(
                            'p',
                            { class: 'docs-version' },
                            /\/(guide|examples)\/(react|vue)$/.test(
                                route.path.replace(/\.html$/, ''),
                            )
                                ? lang.value === 'zh-CN'
                                    ? '当前工作区组件预览 · 尚未发布'
                                    : 'Workspace component preview · Not released'
                                : lang.value === 'zh-CN'
                                  ? '文档对应 SoEditor 1.2.1'
                                  : 'Documentation for SoEditor 1.2.1',
                        ),
                });
        },
    }),
    enhanceApp({ app }) {
        app.component('EditorDemo', Demo);
    },
} satisfies Theme;
