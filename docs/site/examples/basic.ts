import { createClassicEditor } from 'soeditor-release/cms';
import { options, instance, type DemoContext } from './shared.js';
export async function mount(ctx: DemoContext) {
    const editor = await createClassicEditor(ctx.host, options(ctx));
    return instance(editor);
}
