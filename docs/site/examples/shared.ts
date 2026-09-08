import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from 'soeditor-release/cms';
export type Locale = 'zh-CN' | 'en';
export interface DemoContext {
    locale: Locale;
    host: HTMLTextAreaElement;
    form: HTMLFormElement;
    controls: HTMLElement;
    output: HTMLElement;
    status: HTMLElement;
    signal: AbortSignal;
}
export interface DemoInstance {
    editors: ClassicEditor[];
    destroy(): Promise<void>;
}
export function options(ctx: DemoContext): CreateClassicEditorOptions {
    return {
        locale: ctx.locale,
        minHeight: 280,
        onChange: () => {
            ctx.status.textContent = label(
                ctx,
                '内容已修改',
                'Content changed',
            );
        },
    };
}
export function label(ctx: DemoContext, zh: string, en: string): string {
    return ctx.locale === 'zh-CN' ? zh : en;
}
export function button(
    ctx: DemoContext,
    zh: string,
    en: string,
    action: () => void | Promise<unknown>,
): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label(ctx, zh, en);
    el.addEventListener(
        'click',
        () => {
            el.disabled = true;
            Promise.resolve()
                .then(action)
                .catch((error: unknown) => {
                    ctx.status.textContent =
                        error instanceof Error
                            ? error.message
                            : label(ctx, '操作失败', 'Action failed');
                })
                .finally(() => {
                    el.disabled = false;
                });
        },
        { signal: ctx.signal },
    );
    ctx.controls.append(el);
    return el;
}
export function instance(...editors: ClassicEditor[]): DemoInstance {
    return {
        editors,
        async destroy() {
            await Promise.all(editors.map((editor) => editor.destroy()));
        },
    };
}
export function delay(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const abort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
        }, 500);
        signal.addEventListener('abort', abort, { once: true });
    });
}
