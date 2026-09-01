import {
    createClassicEditor,
    type ClassicEditor,
    type ClassicEditorChange,
    type CreateClassicEditorOptions,
} from '@soeditor/editor';
import {
    pastePipelineServiceToken,
    visualEditingServiceToken,
    type EditingSelection,
} from '@soeditor/engine';
import {
    fileManagerServiceToken,
    uploadServiceToken,
    uploadWorkflowServiceToken,
    type FileManagerOpenOptions,
    type FileManagerResult,
    type UploadRequest,
} from '@soeditor/file-manager';
import {
    cmsEmbedProviderServiceToken,
    linkTargetProviderServiceToken,
} from '@soeditor/rich-text';
import type { EditorSaveState } from '@soeditor/workspace';
import '@soeditor/editor/styles.css';
import './classic-demo.css';

const showcaseHtml = [
    '<h1>用 SoEditor 构建现代内容体验</h1>',
    '<p><span class="cms-lead">这是一段由 CMS 语义样式控制的导语。</span> 编辑者可以使用熟悉的工具栏，同时保留开发者需要的 HTML 自由。</p>',
    '<blockquote><p>未知标签与 CMS 标记会被保留；危险脚本不会在可视化编辑区执行。</p></blockquote>',
    '<h2>本次发布重点</h2>',
    '<ul><li>可靠的 Office 粘贴与图片上传</li><li>嵌套列表与完整表格操作<ul><li>支持键盘与历史撤销</li></ul></li><li>中文、移动端与无障碍交互</li></ul>',
    '<table><caption>CMS 功能交付状态</caption><thead><tr><th>能力</th><th>状态</th><th>验证</th></tr></thead><tbody><tr><td>Classic 表单</td><td>完成</td><td>Browser</td></tr><tr><td>Office 粘贴</td><td>完成</td><td>Fixtures</td></tr><tr><td>上传与表格</td><td>完成</td><td>Unit + Browser</td></tr></tbody></table>',
    '<p><img src="/demo-editor-cover.svg" alt="SoEditor CMS 示例封面" width="640" height="240"></p>',
    '<aside data-soeditor-object="promo" data-campaign="summer" data-theme="violet"></aside>',
    '<!--CMS:block--><product-card data-id="42"></product-card>',
].join('');

const form = requiredElement<HTMLFormElement>('article-form');
const textarea = requiredElement<HTMLTextAreaElement>('content');
const submitted = requiredElement<HTMLOutputElement>('submitted');
const saveStateElement = requiredElement<HTMLElement>('demo-save-state');
const modeElement = requiredElement<HTMLElement>('demo-mode');
const toast = requiredElement<HTMLElement>('demo-toast');
const demoParameters = new URLSearchParams(globalThis.location.search);
const testMode = demoParameters.has('test');
document.body.classList.toggle('demo-test-mode', testMode);
if (testMode) {
    requiredElement<HTMLButtonElement>('reset').ariaLabel = 'Reset article';
    requiredElement<HTMLButtonElement>('submit').ariaLabel = 'Save article';
}
let blurCount = 0;
let changeCount = 0;
let focusCount = 0;
let readyCount = 0;
let latestChange: ClassicEditorChange | undefined;
let conflictNextSave = false;
let readonly = false;
let darkTheme = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const editor = await createClassicEditor(textarea, {
    ariaLabel: testMode ? 'Article editor' : '文章内容编辑器',
    autoGrow: testMode,
    config: {
        cms: {
            styles: [
                {
                    attributes: [{ name: 'class', value: 'cms-lead' }],
                    element: 'span',
                    id: 'lead',
                    label: 'Lead text',
                    target: 'inline',
                },
            ],
            objects: [
                {
                    element: 'aside',
                    id: 'promo',
                    label: 'Promotion',
                    properties: ['campaign', 'theme'],
                },
            ],
        },
    },
    ...(testMode ? {} : { data: showcaseHtml }),
    editingModes: ['wysiwyg', 'source'],
    initialEditingMode: 'wysiwyg',
    initialHeight: testMode ? 192 : 560,
    ...(testMode ? {} : { locale: 'zh-CN' }),
    maxHeight: testMode ? 480 : 900,
    minHeight: testMode ? 160 : 420,
    onBlur: () => {
        blurCount += 1;
    },
    onChange: (change) => {
        changeCount += 1;
        latestChange = change;
        updateMode();
    },
    onFocus: () => {
        focusCount += 1;
    },
    onReady: () => {
        readyCount += 1;
    },
    placeholder: testMode ? 'Write article content' : '开始撰写文章内容…',
    ...(testMode
        ? {}
        : {
              save: {
                  adapter: {
                      save: async (request) => {
                          request.reportProgress(0.25);
                          await abortableDelay(320, request.signal);
                          request.reportProgress(0.8);
                          if (conflictNextSave) {
                              conflictNextSave = false;
                              return {
                                  message:
                                      '服务器上已有更新版本，请确认后重试。',
                                  revisionToken: 'server-revision-2',
                                  status: 'conflict' as const,
                              };
                          }
                          return {
                              revisionToken: `demo-${String(request.revision)}`,
                              status: 'saved' as const,
                          };
                      },
                  },
                  autoSaveDelay: 2_000,
                  initialRevisionToken: 'demo-1',
                  onStateChange: updateSaveState,
              },
          }),
    ...(testMode
        ? {}
        : {
              themeVariables: {
                  accent: '#5951df',
                  accentContrast: '#ffffff',
                  controlSize: '2.25rem',
                  focusRing: '#635bff',
                  radius: '0.5rem',
              },
          }),
});

const pasteDiagnostics: string[] = [];
editor.element
    .querySelector<HTMLSelectElement>('[data-classic-action="workspace-view"]')
    ?.addEventListener('change', updateMode);
editor.editor.services
    .get(pastePipelineServiceToken)
    .subscribe((diagnostic) => pasteDiagnostics.push(diagnostic.code));
type UploadMode = 'fail' | 'manual' | 'success' | 'unsafe';
let uploadMode: UploadMode = 'success';
const uploadResolvers: (() => void)[] = [];
editor.editor.services.register(uploadServiceToken, {
    create: (request: UploadRequest) => {
        const mode = uploadMode;
        let cancelled = false;
        const progressListeners = new Set<
            (progress: {
                readonly loaded: number;
                readonly total?: number;
            }) => void
        >();
        const result = new Promise<{
            alt: string;
            height: number;
            url: string;
            width: number;
        }>((resolve, reject) => {
            const finish = (): void => {
                if (cancelled) return;
                progressListeners.forEach((listener) =>
                    listener({ loaded: request.size, total: request.size }),
                );
                if (mode === 'fail') {
                    reject(new Error('Demo upload failed.'));
                    return;
                }
                resolve({
                    alt: request.name,
                    height: 240,
                    url:
                        mode === 'unsafe'
                            ? 'javascript:alert(1)'
                            : `/uploads/${request.name}`,
                    width: 320,
                });
            };
            if (mode === 'manual') uploadResolvers.push(finish);
            else queueMicrotask(finish);
        });
        return {
            cancel: () => {
                cancelled = true;
            },
            result,
            subscribe: (
                listener: (progress: {
                    readonly loaded: number;
                    readonly total?: number;
                }) => void,
            ) => {
                progressListeners.add(listener);
                listener({ loaded: 0, total: request.size });
                return () => progressListeners.delete(listener);
            },
        };
    },
});
editor.editor.services.register(fileManagerServiceToken, {
    open: (options) => openDemoAssetManager(options),
});
editor.editor.services.register(linkTargetProviderServiceToken, {
    select: (kind) =>
        Promise.resolve(
            kind === 'file'
                ? { href: '/assets/guide.pdf', title: 'Guide' }
                : { href: '/articles/42', title: 'Article 42' },
        ),
});

function openDemoAssetManager(
    options: FileManagerOpenOptions,
): Promise<FileManagerResult | null> {
    const assets: readonly (FileManagerResult & {
        readonly kind: 'file' | 'image' | 'media';
    })[] = [
        {
            alt: 'SoEditor CMS 示例封面',
            height: 240,
            kind: 'image',
            mime: 'image/svg+xml',
            name: '编辑器封面.svg',
            url: '/demo-editor-cover.svg',
            width: 640,
        },
        {
            alt: '产品演示视频',
            kind: 'media',
            mime: 'video/mp4',
            name: '产品演示.mp4',
            url: '/media/product-demo.mp4',
        },
        {
            kind: 'file',
            mime: 'application/pdf',
            name: 'SoEditor 内容指南.pdf',
            url: '/assets/soeditor-content-guide.pdf',
        },
    ];
    const compatible = assets.filter((asset) =>
        options.kind === 'media'
            ? asset.kind === 'media' || asset.kind === 'image'
            : asset.kind === options.kind,
    );
    const dialog = document.createElement('dialog');
    dialog.className = 'demo-asset-manager';
    dialog.setAttribute('aria-label', 'CMS asset manager');
    const heading = document.createElement('h2');
    heading.textContent = testMode ? 'Choose an asset' : '选择 CMS 资源';
    const hint = document.createElement('p');
    hint.textContent = `${options.kind.toUpperCase()} · ${
        options.accept?.join(', ') ?? '*/*'
    }`;
    const grid = document.createElement('div');
    grid.className = 'demo-asset-manager__grid';
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value: FileManagerResult | null): void => {
            if (settled) return;
            settled = true;
            dialog.close();
            dialog.remove();
            resolve(value);
        };
        for (const asset of compatible) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'demo-asset-manager__asset';
            button.textContent = `${asset.kind === 'image' ? '▧' : asset.kind === 'media' ? '▶' : '📎'} ${asset.name ?? asset.url}`;
            button.addEventListener('click', () =>
                finish(toManagerResult(asset)),
            );
            grid.append(button);
        }
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'demo-asset-manager__cancel';
        cancel.textContent = testMode ? 'Cancel' : '取消';
        cancel.addEventListener('click', () => finish(null));
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            finish(null);
        });
        dialog.append(heading, hint, grid, cancel);
        document.body.append(dialog);
        dialog.showModal();
    });
}

function toManagerResult(
    asset: FileManagerResult & { readonly kind: 'file' | 'image' | 'media' },
): FileManagerResult {
    return Object.freeze({
        url: asset.url,
        ...(asset.alt === undefined ? {} : { alt: asset.alt }),
        ...(asset.height === undefined ? {} : { height: asset.height }),
        ...(asset.metadata === undefined ? {} : { metadata: asset.metadata }),
        ...(asset.mime === undefined ? {} : { mime: asset.mime }),
        ...(asset.name === undefined ? {} : { name: asset.name }),
        ...(asset.width === undefined ? {} : { width: asset.width }),
    });
}
editor.editor.services.register(cmsEmbedProviderServiceToken, {
    resolve: (url) =>
        Promise.resolve({
            provider: 'demo-video',
            title: 'Demo video',
            url: url.includes('unsafe') ? 'javascript:alert(1)' : url,
        }),
});

form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitted.value = String(new FormData(form).get('content') ?? '');
    if (!testMode) showToast('已通过原生表单提交规范 HTML');
});

if (!testMode) {
    attachTourActions();
    updateMode();
    updateSaveState(editor.saveWorkflow?.state);
}

Reflect.set(
    globalThis,
    '__classicDemo',
    Object.freeze({
        create: (
            host: HTMLElement,
            options?: CreateClassicEditorOptions,
        ): Promise<ClassicEditor> => createClassicEditor(host, options),
        destroy: (): Promise<void> => editor.destroy(),
        editor,
        execute: (commandId: string, ...args: readonly unknown[]): unknown =>
            editor.editor.execute(commandId, ...args),
        events: () =>
            Object.freeze({
                blurCount,
                changeCount,
                focusCount,
                latestChange,
                readyCount,
            }),
        formData: (): string => String(new FormData(form).get('content') ?? ''),
        getData: (): string => editor.getData(),
        pasteDiagnostics: (): readonly string[] => [...pasteDiagnostics],
        resolveUploads: (): void => {
            for (const resolve of uploadResolvers.splice(0)) resolve();
        },
        select: (selection: EditingSelection): boolean =>
            editor.editor.services
                .get(visualEditingServiceToken)
                .setSelection(selection, true),
        setUploadMode: (mode: UploadMode): void => {
            uploadMode = mode;
        },
        upload: (name: string): Promise<unknown> => uploadImage(name),
        uploadCancel: (id: string): boolean =>
            editor.editor.services.get(uploadWorkflowServiceToken).cancel(id),
        uploadRecords: () =>
            editor.editor.services.get(uploadWorkflowServiceToken).list(),
        uploadRetry: (id: string): Promise<unknown> =>
            editor.editor.services.get(uploadWorkflowServiceToken).retry(id),
    }),
);

document.body.dataset.ready = 'true';

function attachTourActions(): void {
    for (const button of Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-demo-action]'),
    )) {
        button.addEventListener('click', () => {
            const action = button.dataset.demoAction;
            void runTourAction(action).catch((error: unknown) => {
                showToast(
                    error instanceof Error ? error.message : String(error),
                );
            });
        });
    }
}

async function runTourAction(action: string | undefined): Promise<void> {
    switch (action) {
        case 'sample':
            editor.setData(showcaseHtml);
            showToast('已恢复包含表格、列表、图片和 CMS 对象的完整示例');
            return;
        case 'office': {
            ensureVisualMode();
            placeSelection(0, 0);
            const result = editor.editor.services
                .get(pastePipelineServiceToken)
                .process({
                    files: [],
                    html: '<h2 style="mso-margin-top-alt:auto" onclick="run()">Office 发布标题</h2><p><b>粘贴内容</b> 已转为语义 HTML。</p><script>run()</script>',
                    source: 'paste',
                    text: 'Office 发布标题\n粘贴内容已转为语义 HTML。',
                    types: ['text/html', 'text/plain'],
                });
            editor.editor.services
                .get(visualEditingServiceToken)
                .insertHtml(result.html);
            showToast('Office 内容已清理：脚本、事件属性和 mso 样式被移除');
            return;
        }
        case 'table':
            ensureVisualMode();
            placeSelection(0, 0);
            editor.editor.execute('table.insert', { columns: 3, rows: 3 });
            showToast('已通过 table.insert 命令插入 3 × 3 表格');
            return;
        case 'upload':
            ensureVisualMode();
            placeSelection(0, 0);
            await uploadImage('cms-demo-image.png');
            showToast('图片已通过 UploadService 插入，未序列化临时 Blob URL');
            return;
        case 'link':
            ensureVisualMode();
            placeSelection(0, 8);
            editor.editor.execute('link.set', {
                href: '/articles/soeditor-1-1',
                rel: 'noopener',
                title: 'SoEditor 1.1 发布说明',
            });
            showToast('已通过安全 URL 策略添加内部链接');
            return;
        case 'source':
            editor.editor.execute(
                editor.editor.state.mode === 'source'
                    ? 'editor.visual'
                    : 'editor.source',
            );
            updateMode();
            return;
        case 'preview':
            editor.setWorkspaceView('source');
            showToast('已打开 HTML 源码');
            return;
        case 'triple':
            editor.setWorkspaceView('wysiwyg');
            showToast('已返回所见即所得编辑');
            return;
        case 'assets':
            ensureVisualMode();
            placeSelection(0, 0);
            await editor.editor.execute('image.browse');
            return;
        case 'readonly':
            readonly = !readonly;
            editor.setReadonly(readonly);
            showToast(readonly ? '编辑器已切换为只读' : '编辑器已恢复编辑');
            return;
        case 'theme':
            darkTheme = !darkTheme;
            document.body.classList.toggle('demo-dark', darkTheme);
            editor.element.dataset.soeditorTheme = darkTheme ? 'dark' : 'light';
            showToast(darkTheme ? '已启用深色编辑器主题' : '已恢复浅色主题');
            return;
        case 'conflict':
            conflictNextSave = true;
            editor.setData(`${editor.getData()}<!--demo-local-change-->`);
            await editor.save();
            showToast('服务器冲突已显示；可点击工具栏重试保存');
            return;
        default:
            throw new Error('未知的演示操作。');
    }
}

function ensureVisualMode(): void {
    if (editor.editor.state.mode === 'source') {
        editor.editor.execute('editor.visual');
    }
    updateMode();
}

function placeSelection(anchorOffset: number, focusOffset: number): void {
    const selected = editor.editor.services
        .get(visualEditingServiceToken)
        .setSelection(
            {
                anchor: { block: 0, offset: anchorOffset },
                focus: { block: 0, offset: focusOffset },
            },
            true,
        );
    if (!selected) throw new Error('无法在示例内容中建立编辑选择。');
}

function uploadImage(name: string): Promise<unknown> {
    return Promise.resolve(
        editor.editor.execute('image.upload', {
            file: new Blob(['image'], { type: 'image/png' }),
            name,
            type: 'image/png',
        }),
    );
}

function updateMode(): void {
    const selected = editor.element.querySelector<HTMLSelectElement>(
        '[data-classic-action="workspace-view"]',
    )?.selectedOptions[0]?.textContent;
    const fallback =
        editor.editor.state.mode === 'source' ? 'Source' : 'WYSIWYG';
    modeElement.innerHTML = `<i></i> ${selected ?? fallback}`;
}

function updateSaveState(state: EditorSaveState | undefined): void {
    if (state === undefined) return;
    const label: Readonly<Record<EditorSaveState['status'], string>> = {
        conflict: '保存冲突',
        destroyed: '已销毁',
        error: '保存失败',
        idle: state.dirty ? '有未保存更改' : '已保存',
        saved: '已保存',
        saving: '保存中',
        scheduled: '等待自动保存',
    };
    saveStateElement.dataset.state = state.status;
    saveStateElement.innerHTML = `<i></i> ${label[state.status]}`;
}

function showToast(message: string): void {
    if (toastTimer !== undefined) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2_600);
}

function abortableDelay(
    milliseconds: number,
    signal: AbortSignal,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, milliseconds);
        signal.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new Error('保存已取消。'));
            },
            { once: true },
        );
    });
}

function requiredElement<ElementType extends HTMLElement>(
    id: string,
): ElementType {
    const element = document.querySelector<ElementType>(`#${id}`);
    if (element === null) throw new Error(`Classic demo requires #${id}.`);
    return element;
}
