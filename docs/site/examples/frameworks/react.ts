import { createElement as h, StrictMode, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { SoEditor } from '@soeditor/react/cms';
import type { ClassicEditor } from '@soeditor/editor/cms';
import { createEditor, initial, label, options } from './shared.js';

function ArticleForm() {
    const [html, setHtml] = useState(initial);
    const [readonly, setReadonly] = useState(false);
    const [version, setVersion] = useState(0);
    const [output, setOutput] = useState('');
    const [status, setStatus] = useState(label('正在加载', 'Loading'));
    const editor = useRef<ClassicEditor | undefined>(undefined);
    const button = (zh: string, en: string, onClick: () => void) =>
        h('button', { type: 'button', onClick }, label(zh, en));
    return h(
        'form',
        {
            onSubmit: (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                setOutput(
                    String(new FormData(event.currentTarget).get('body')),
                );
            },
        },
        h(
            'p',
            { className: 'notice' },
            label(
                'React 组件示例：内容仅保存在本页。',
                'React component demo: content stays in this page.',
            ),
        ),
        h(
            'div',
            { className: 'controls' },
            button('替换 HTML', 'Replace HTML', () =>
                setHtml('<h2>Updated article</h2><p>External value</p>'),
            ),
            button('切换只读', 'Toggle readonly', () => setReadonly(!readonly)),
            button('读取 HTML', 'Read HTML', () =>
                setOutput(editor.current?.getData() ?? ''),
            ),
            button('HTML Source', 'HTML Source', () => {
                void editor.current?.setWorkspaceView('source');
            }),
            button('重建示例', 'Recreate demo', () => {
                editor.current = undefined;
                setVersion(version + 1);
            }),
            h('button', { type: 'submit' }, label('提交表单', 'Submit form')),
            h('button', { type: 'reset' }, label('重置表单', 'Reset form')),
        ),
        h('p', { role: 'status' }, status),
        h(SoEditor, {
            key: version,
            name: 'body',
            value: html,
            onChange: setHtml,
            readonly,
            options,
            createEditor,
            onReady: (instance) => {
                editor.current = instance;
                setStatus(label('就绪', 'Ready'));
                document.body.dataset.ready = 'true';
            },
            onError: (error) => setStatus(String(error)),
        }),
        h('output', { 'data-bound-value': '' }, html),
        h('pre', null, output),
    );
}
const host = document.getElementById('app');
if (!host) throw new Error('Missing app host');
const root = createRoot(host);
root.render(h(StrictMode, null, h(ArticleForm)));
window.addEventListener('pagehide', () => root.unmount(), { once: true });
