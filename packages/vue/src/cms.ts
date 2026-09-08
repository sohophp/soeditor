import {
    defineComponent,
    h,
    onBeforeUnmount,
    onMounted,
    shallowRef,
    watch,
    type PropType,
} from 'vue';
import type {
    ClassicEditor,
    ClassicEditorChange,
    CreateClassicEditorOptions,
} from '@soeditor/editor/cms';

export type SoEditorOptions = Omit<
    CreateClassicEditorOptions,
    | 'data'
    | 'readonly'
    | 'onChange'
    | 'onReady'
    | 'onError'
    | 'onFocus'
    | 'onBlur'
>;
export type SoEditorFactory = (
    host: HTMLElement,
    options: CreateClassicEditorOptions,
) => Promise<ClassicEditor>;

/** Vue 3 CMS textarea with v-model and native form synchronization. */
export const SoEditor = defineComponent({
    name: 'SoEditor',
    inheritAttrs: false,
    props: {
        modelValue: { type: String, default: undefined },
        defaultValue: { type: String, default: '' },
        readonly: { type: Boolean, default: false },
        name: String,
        id: String,
        options: Object as PropType<SoEditorOptions>,
        createEditor: Function as PropType<SoEditorFactory>,
    },
    emits: {
        'update:modelValue': (html: string) => typeof html === 'string',
        change: (html: string, change: ClassicEditorChange) =>
            typeof html === 'string' && typeof change.source === 'string',
        ready: (editor: ClassicEditor) => typeof editor.getData === 'function',
        error: (error: unknown) => {
            void error;
            return true;
        },
        focus: (editor: ClassicEditor) => typeof editor.getData === 'function',
        blur: (editor: ClassicEditor) => typeof editor.getData === 'function',
    },
    setup(props, { attrs, emit, expose }) {
        const host = shallowRef<HTMLTextAreaElement>();
        const editor = shallowRef<ClassicEditor>();
        const initial = props.modelValue ?? props.defaultValue;
        let cancelled = false;
        let applying = false;
        const report = (error: unknown) => {
            if (!cancelled) emit('error', error);
        };
        const sync = () => {
            if (!editor.value || editor.value.destroyed) return;
            try {
                applying = true;
                if (
                    props.modelValue !== undefined &&
                    props.modelValue !== editor.value.getData()
                )
                    editor.value.setData(props.modelValue);
                editor.value.setReadonly(props.readonly);
            } catch (error: unknown) {
                report(error);
            } finally {
                applying = false;
            }
        };
        expose({ getEditor: () => editor.value });
        onMounted(async () => {
            try {
                const create =
                    props.createEditor ??
                    (await import('@soeditor/editor/cms')).createClassicEditor;
                if (cancelled || !host.value) return;
                const created = await create(host.value, {
                    ...props.options,
                    data: props.modelValue ?? initial,
                    readonly: props.readonly,
                    onChange: (change) => {
                        if (cancelled || applying) return;
                        emit('update:modelValue', change.source);
                        emit('change', change.source, change);
                    },
                    onError: report,
                    onFocus: (instance) => {
                        if (!cancelled) emit('focus', instance);
                    },
                    onBlur: (instance) => {
                        if (!cancelled) emit('blur', instance);
                    },
                });
                if (cancelled) {
                    await created.destroy();
                    return;
                }
                editor.value = created;
                sync();
                emit('ready', created);
            } catch (error: unknown) {
                report(error);
            }
        });
        watch(() => [props.modelValue, props.readonly], sync);
        onBeforeUnmount(() => {
            cancelled = true;
            const mounted = editor.value;
            editor.value = undefined;
            void mounted
                ?.destroy()
                .catch((error: unknown) => emit('error', error));
        });
        return () =>
            h('div', attrs, [
                h(
                    'textarea',
                    {
                        ref: host,
                        id: props.id,
                        name: props.name,
                        readonly: true,
                        'aria-label': props.options?.ariaLabel,
                    },
                    initial,
                ),
            ]);
    },
});
