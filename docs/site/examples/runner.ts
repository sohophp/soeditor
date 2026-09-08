import 'soeditor-release/cms/styles.css';
import './style.css';
import {
    button,
    label,
    type DemoContext,
    type DemoInstance,
} from './shared.js';
const loaders = {
    video: () => import('./video.js'),
    basic: () => import('./basic.js'),
    form: () => import('./form.js'),
    source: () => import('./source.js'),
    assets: () => import('./assets.js'),
    save: () => import('./save.js'),
    multiple: () => import('./multiple.js'),
};
const name = document.documentElement.dataset.example ?? 'basic';
function isExample(value: string): value is keyof typeof loaders {
    return value in loaders;
}
if (!isExample(name)) throw new Error('Unknown example');
const loadExample = loaders[name];
const locale =
    new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh-CN';
document.documentElement.lang = locale;
const form = document.createElement('form');
const host = document.createElement('textarea');
host.name = 'content';
host.setAttribute(
    'aria-label',
    locale === 'en' ? 'Article content' : '文章内容',
);
const initial =
    locale === 'en'
        ? '<h2>A place for your next story</h2><p>Edit this article with SoEditor.</p><table><tbody><tr><th>Feature</th><th>Use</th></tr><tr><td>HTML</td><td>CMS content</td></tr></tbody></table>'
        : '<h2>从这里开始你的下一篇文章</h2><p>使用 SoEditor 编辑文章内容。</p><table><tbody><tr><th>功能</th><th>用途</th></tr><tr><td>HTML</td><td>CMS 内容</td></tr></tbody></table>';
host.defaultValue = initial;
form.append(host);
const controls = document.createElement('div');
controls.className = 'controls';
const status = document.createElement('p');
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');
const details = document.createElement('details');
const summary = document.createElement('summary');
summary.textContent = 'HTML';
const output = document.createElement('pre');
details.append(summary, output);
const note = document.createElement('p');
note.className = 'notice';
note.textContent =
    locale === 'en'
        ? 'Local demo. Upload and save are simulated; no content is sent to a server.'
        : '本地演示：上传和保存均为模拟，编辑内容不会发送到服务器。';
document.body.append(note, controls, status, form, details);
let owned: DemoInstance | undefined;
let disposed = false;
let controller = new AbortController();
let task: Promise<void> = Promise.resolve();
async function mount() {
    controller = new AbortController();
    const ctx: DemoContext = {
        locale,
        host,
        form,
        controls,
        output,
        status,
        signal: controller.signal,
    };
    status.textContent = label(ctx, '正在加载…', 'Loading…');
    const module = await loadExample();
    if (disposed) return;
    const mounted = await module.mount(ctx);
    owned = mounted;
    if (disposed) {
        await mounted.destroy();
        owned = undefined;
        return;
    }
    button(ctx, '读取 HTML', 'Read HTML', () => {
        output.textContent =
            owned?.editors.map((editor) => editor.getData()).join('\n\n') ?? '';
        details.open = true;
    });
    button(ctx, '重建示例', 'Recreate demo', () => {
        task = task.then(async () => {
            controller.abort();
            await owned?.destroy();
            owned = undefined;
            controls.replaceChildren();
            host.value = initial;
            output.textContent = '';
            await mount();
        });
        return task;
    });
    status.textContent = label(ctx, '就绪', 'Ready');
    document.body.dataset.ready = 'true';
}
window.addEventListener(
    'pagehide',
    () => {
        disposed = true;
        controller.abort();
        void owned?.destroy();
    },
    { once: true },
);
task = mount().catch((error: unknown) => {
    status.textContent =
        error instanceof Error ? error.message : 'Failed to initialize';
});
