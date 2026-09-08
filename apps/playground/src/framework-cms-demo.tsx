import { SoEditor as ReactEditor } from '@soeditor/react/cms';
import { SoEditor as VueEditor } from '@soeditor/vue/cms';
import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from '@soeditor/editor/cms';
import '@soeditor/editor/cms/styles.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, defineComponent, h, ref } from 'vue';

const parameters = new URLSearchParams(location.search);
const initial = '<p>Initial CMS content</p>';
const instances: ClassicEditor[] = [];
const errors: string[] = [];
let creates = 0;
let changes = 0;
let release: (() => void) | undefined;
const gate = parameters.has('delay')
    ? new Promise<void>((resolve) => {
          release = resolve;
      })
    : Promise.resolve();
const createEditor = async (
    host: HTMLElement,
    options: CreateClassicEditorOptions,
) => {
    creates++;
    if (parameters.has('fail') && creates <= 2)
        throw new Error('Expected CMS mount failure');
    const module = parameters.has('source')
        ? await import('@soeditor/editor/cms/optional')
        : await import('@soeditor/editor/cms');
    const editor = await module.createClassicEditor(host, options);
    instances.push(editor);
    await gate;
    return editor;
};
const options: CreateClassicEditorOptions = {
    ariaLabel: 'Article HTML',
    ...(parameters.has('source')
        ? { editingModes: ['wysiwyg', 'source'] }
        : {}),
};
let updateReact: ((value: string) => void) | undefined;
let readonlyReact: (() => void) | undefined;
let mountReact: ((mounted: boolean) => void) | undefined;
function ReactExample() {
    const [value, setValue] = useState(initial);
    const [readonly, setReadonly] = useState(false);
    const [mounted, setMounted] = useState(true);
    updateReact = setValue;
    readonlyReact = () => setReadonly((previous) => !previous);
    mountReact = setMounted;
    return (
        <section aria-label="React editor">
            {mounted && (
                <ReactEditor
                    name="reactHtml"
                    value={value}
                    readonly={readonly}
                    options={options}
                    createEditor={createEditor}
                    onChange={(html) => {
                        changes++;
                        setValue(html);
                    }}
                    onError={(error) => errors.push(String(error))}
                />
            )}
            <output id="react-value">{value}</output>
        </section>
    );
}
const vueValue = ref(initial);
const vueReadonly = ref(false);
const vueMounted = ref(true);
const VueExample = defineComponent({
    setup() {
        return () =>
            h('section', { 'aria-label': 'Vue editor' }, [
                ...(vueMounted.value
                    ? [
                          h(VueEditor, {
                              name: 'vueHtml',
                              modelValue: vueValue.value,
                              readonly: vueReadonly.value,
                              options,
                              createEditor,
                              'onUpdate:modelValue': (html: string) => {
                                  changes++;
                                  vueValue.value = html;
                              },
                              onError: (error: unknown) =>
                                  errors.push(String(error)),
                          }),
                      ]
                    : []),
                h('output', { id: 'vue-value' }, vueValue.value),
            ]);
    },
});
const reactHost = document.getElementById('react-root');
if (!reactHost) throw new Error('Missing React host');
createRoot(reactHost).render(
    <StrictMode>
        <ReactExample />
    </StrictMode>,
);
createApp(VueExample).mount('#vue-root');
document.getElementById('external')?.addEventListener('click', () => {
    updateReact?.('<p>External CMS content</p>');
    vueValue.value = '<p>External CMS content</p>';
});
document.getElementById('readonly')?.addEventListener('click', () => {
    readonlyReact?.();
    vueReadonly.value = !vueReadonly.value;
});
document.getElementById('unmount')?.addEventListener('click', () => {
    mountReact?.(false);
    vueMounted.value = false;
});
document.getElementById('remount')?.addEventListener('click', () => {
    mountReact?.(true);
    vueMounted.value = true;
});
document
    .getElementById('release')
    ?.addEventListener('click', () => release?.());
Reflect.set(globalThis, '__frameworkCms', {
    snapshot: () => ({
        creates,
        changes,
        errors,
        live: instances.filter((editor) => !editor.destroyed).length,
    }),
    source: async () => {
        for (const editor of instances)
            if (!editor.destroyed) await editor.setWorkspaceView('source');
    },
});
