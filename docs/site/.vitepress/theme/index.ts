import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import type { Theme } from 'vitepress';
import Demo from './Demo.vue';
import './style.css';
export default {
    extends: DefaultTheme,
    Layout: () =>
        h(DefaultTheme.Layout, null, { 'home-hero-after': () => h(Demo) }),
    enhanceApp({ app }) {
        app.component('EditorDemo', Demo);
    },
} satisfies Theme;
