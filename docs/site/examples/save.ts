import { createClassicEditor } from 'soeditor-release/cms/optional';
import {
    options,
    instance,
    button,
    delay,
    label,
    type DemoContext,
} from './shared.js';
export async function mount(ctx: DemoContext) {
    let failNext = false;
    const editor = await createClassicEditor(ctx.host, {
        ...options(ctx),
        save: {
            adapter: {
                async save({ source, signal }) {
                    await delay(signal);
                    if (failNext) {
                        failNext = false;
                        throw new Error(
                            label(
                                ctx,
                                '模拟保存失败，请重试',
                                'Mock save failed. Retry.',
                            ),
                        );
                    }
                    ctx.output.textContent = source;
                    return {
                        status: 'saved',
                        revisionToken: String(Date.now()),
                    };
                },
            },
            onStateChange(state) {
                ctx.status.dataset.dirty = String(state.dirty);
                const statuses: Record<string, string> =
                    ctx.locale === 'zh-CN'
                        ? {
                              idle: '就绪',
                              saving: '保存中',
                              saved: '已保存',
                              error: '保存失败',
                              conflict: '冲突',
                              scheduled: '等待保存',
                              destroyed: '已销毁',
                          }
                        : {
                              idle: 'Ready',
                              saving: 'Saving',
                              saved: 'Saved',
                              error: 'Save failed',
                              conflict: 'Conflict',
                              scheduled: 'Scheduled',
                              destroyed: 'Destroyed',
                          };
                ctx.status.textContent = `${statuses[state.status] ?? state.status} · ${state.dirty ? label(ctx, '未保存', 'Unsaved') : label(ctx, '已同步', 'Clean')}`;
            },
        },
    });
    button(ctx, '保存', 'Save', () => editor.save());
    button(ctx, '下次保存失败', 'Fail next save', () => {
        failNext = true;
        ctx.status.textContent = label(
            ctx,
            '下次保存将模拟失败',
            'The next save will fail',
        );
    });
    button(ctx, '重试保存', 'Retry save', () => editor.retrySave());
    return instance(editor);
}
