import DefaultTheme from 'vitepress/theme';
import { defineComponent, h } from 'vue';
import { useData } from 'vitepress';
import type { Theme } from 'vitepress';
import Demo from './Demo.vue';
import './style.css';
export default {
    extends: DefaultTheme,
    Layout: defineComponent({
        setup() {
            const { lang } = useData();
            return () =>
                h(DefaultTheme.Layout, null, {
                    'home-hero-after': () => h(Demo),
                    'doc-before': () =>
                        h(
                            'p',
                            { class: 'docs-version' },
                            lang.value === 'zh-CN'
                                ? '文档对应 SoEditor 1.4.0'
                                : 'Documentation for SoEditor 1.4.0',
                        ),
                });
        },
    }),
    enhanceApp({ app }) {
        app.component('EditorDemo', Demo);
    },
} satisfies Theme;
