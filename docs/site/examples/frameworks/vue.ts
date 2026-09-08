import { createApp, defineComponent, h, ref, shallowRef } from 'vue';
import { SoEditor } from '@soeditor/vue/cms';
import type { ClassicEditor } from '@soeditor/editor/cms';
import { createEditor, initial, label, options } from './shared.js';

const ArticleForm = defineComponent({
    setup() {
        const html = ref(initial);
        const readonly = ref(false);
        const version = ref(0);
        const output = ref('');
        const status = ref(label('正在加载', 'Loading'));
        const editor = shallowRef<ClassicEditor>();
        const button = (zh: string, en: string, onClick: () => void) =>
            h('button', { type: 'button', onClick }, label(zh, en));
        return () =>
            h(
                'form',
                {
                    onSubmit: (event: Event) => {
                        event.preventDefault();
                        if (event.currentTarget instanceof HTMLFormElement)
                            output.value = String(
                                new FormData(event.currentTarget).get('body'),
                            );
                    },
                },
                [
                    h(
                        'p',
                        { className: 'notice' },
                        label(
                            'Vue 组件预览：内容仅保存在本页。',
                            'Vue component preview: content stays in this page.',
                        ),
                    ),
                    h('div', { className: 'controls' }, [
                        button('替换 HTML', 'Replace HTML', () => {
                            html.value =
                                '<h2>Updated article</h2><p>External value</p>';
                        }),
                        button('切换只读', 'Toggle readonly', () => {
                            readonly.value = !readonly.value;
                        }),
                        button('读取 HTML', 'Read HTML', () => {
                            output.value = editor.value?.getData() ?? '';
                        }),
                        button('HTML Source', 'HTML Source', () => {
                            void editor.value?.setWorkspaceView('source');
                        }),
                        button('重建示例', 'Recreate demo', () => {
                            editor.value = undefined;
                            version.value++;
                        }),
                        h(
                            'button',
                            { type: 'submit' },
                            label('提交表单', 'Submit form'),
                        ),
                        h(
                            'button',
                            { type: 'reset' },
                            label('重置表单', 'Reset form'),
                        ),
                    ]),
                    h('p', { role: 'status' }, status.value),
                    h(SoEditor, {
                        key: version.value,
                        name: 'body',
                        modelValue: html.value,
                        'onUpdate:modelValue': (value: string) => {
                            html.value = value;
                        },
                        readonly: readonly.value,
                        options,
                        createEditor,
                        onReady: (instance: ClassicEditor) => {
                            editor.value = instance;
                            status.value = label('就绪', 'Ready');
                            document.body.dataset.ready = 'true';
                        },
                        onError: (error: unknown) => {
                            status.value = String(error);
                        },
                    }),
                    h('output', { 'data-bound-value': '' }, html.value),
                    h('pre', null, output.value),
                ],
            );
    },
});
const app = createApp(ArticleForm);
app.mount('#app');
window.addEventListener('pagehide', () => app.unmount(), { once: true });
