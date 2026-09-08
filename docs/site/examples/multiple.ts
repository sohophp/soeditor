import { createClassicEditor } from 'soeditor-release/cms';
import { options, instance, type DemoContext } from './shared.js';
export async function mount(ctx: DemoContext) {
    const second = document.createElement('textarea');
    second.name = 'secondary';
    second.setAttribute(
        'aria-label',
        ctx.locale === 'zh-CN' ? '第二个编辑器' : 'Second editor',
    );
    second.value =
        ctx.locale === 'zh-CN'
            ? '<p>第二个独立编辑器</p>'
            : '<p>Second independent editor</p>';
    ctx.form.append(second);
    const first = await createClassicEditor(ctx.host, options(ctx));
    try {
        const other = await createClassicEditor(second, options(ctx));
        const owned = instance(first, other);
        return {
            ...owned,
            async destroy() {
                await owned.destroy();
                second.remove();
            },
        };
    } catch (error) {
        await first.destroy();
        second.remove();
        throw error;
    }
}
