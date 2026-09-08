import { createClassicEditor } from 'soeditor-release/cms';
import {
    options,
    instance,
    button,
    label,
    type DemoContext,
} from './shared.js';
export async function mount(ctx: DemoContext) {
    const editor = await createClassicEditor(ctx.host, options(ctx));
    ctx.form.addEventListener(
        'submit',
        (event) => {
            event.preventDefault();
            ctx.output.textContent = String(
                new FormData(ctx.form).get('content'),
            );
            ctx.status.textContent = label(
                ctx,
                '表单已读取，未发送网络请求',
                'Form read locally; no request was sent',
            );
        },
        { signal: ctx.signal },
    );
    button(ctx, '提交表单', 'Submit form', () => ctx.form.requestSubmit());
    button(ctx, '重置表单', 'Reset form', () => ctx.form.reset());
    return instance(editor);
}
