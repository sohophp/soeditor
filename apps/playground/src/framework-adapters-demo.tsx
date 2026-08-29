import { useSoEditorWorkspace as useReactWorkspace } from '@soeditor/react';
import { Editor } from '@soeditor/core';
import type { EditorWorkspace } from '@soeditor/workspace';
import { useSoEditorWorkspace as useVueWorkspace } from '@soeditor/vue';
import {
    Component,
    StrictMode,
    Suspense,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, defineComponent, h, onMounted, ref, type Ref } from 'vue';

let reactCreates = 0;
let reactDestroys = 0;
let vueCreates = 0;
let vueDestroys = 0;
let setReactValue: ((value: string) => void) | undefined;
let setReactReadonly: ((value: boolean) => void) | undefined;
let vueValue: Ref<string> | undefined;
let vueReadonly: Ref<boolean> | undefined;
let reactWorkspace: EditorWorkspace | undefined;
let vueWorkspace: EditorWorkspace | undefined;

function ReactExample() {
    const host = useRef<HTMLDivElement | null>(null);
    const [value, updateValue] = useState('<p>React initial</p>');
    const [isReadonly, updateReadonly] = useState(false);
    const result = useReactWorkspace({
        attachments: [domAttachment('react', host, () => reactDestroys++)],
        createEditor: ({ source }) => {
            reactCreates += 1;
            return Editor.create({ data: source });
        },
        onChange: ({ source }) => updateValue(source),
        onReady: (workspace) => {
            reactWorkspace = workspace;
        },
        readonly: isReadonly,
        value,
    });
    useEffect(() => {
        setReactValue = updateValue;
        setReactReadonly = updateReadonly;
        return () => {
            setReactValue = undefined;
            setReactReadonly = undefined;
        };
    }, []);
    return (
        <div>
            <div ref={host} data-testid="react-host" />
            <output data-testid="react-status">{result.status}</output>
        </div>
    );
}

function FailingReactExample() {
    const result = useReactWorkspace({
        createEditor: () => {
            throw new Error('Expected adapter mount failure');
        },
        initialValue: '',
        throwOnError: true,
    });
    return <output>{result.status}</output>;
}

class AdapterErrorBoundary extends Component<
    { readonly children: ReactNode },
    { readonly error: string | undefined }
> {
    override state = { error: undefined };

    static getDerivedStateFromError(error: unknown) {
        return {
            error: error instanceof Error ? error.message : String(error),
        };
    }

    override render() {
        return this.state.error === undefined ? (
            this.props.children
        ) : (
            <p role="alert">{this.state.error}</p>
        );
    }
}

const VueExample = defineComponent({
    setup() {
        const host = ref<HTMLElement>();
        const value = ref('<p>Vue initial</p>');
        const isReadonly = ref(false);
        const result = useVueWorkspace({
            attachments: [domAttachment('vue', host, () => vueDestroys++)],
            createEditor: ({ source }) => {
                vueCreates += 1;
                return Editor.create({ data: source });
            },
            onChange: ({ source }) => {
                value.value = source;
            },
            onReady: (workspace) => {
                vueWorkspace = workspace;
            },
            readonly: isReadonly,
            value,
        });
        onMounted(() => {
            vueValue = value;
            vueReadonly = isReadonly;
        });
        return () =>
            h('div', [
                h('div', { ref: host, 'data-testid': 'vue-host' }),
                h(
                    'output',
                    { 'data-testid': 'vue-status' },
                    result.status.value,
                ),
            ]);
    },
});

const reactRoot = createRoot(requiredElement('react-root'));
reactRoot.render(
    <StrictMode>
        <Suspense fallback={<p data-testid="react-fallback">Loading</p>}>
            <ReactExample />
        </Suspense>
    </StrictMode>,
);
const reactErrorRoot = createRoot(requiredElement('react-error-root'));
reactErrorRoot.render(
    <AdapterErrorBoundary>
        <FailingReactExample />
    </AdapterErrorBoundary>,
);
const vueApp = createApp(VueExample);
vueApp.mount(requiredElement('vue-root'));

Reflect.set(
    globalThis,
    '__frameworkAdaptersDemo',
    Object.freeze({
        destroy: async () => {
            reactRoot.unmount();
            reactErrorRoot.unmount();
            vueApp.unmount();
            await waitFor(
                () =>
                    reactDestroys >= reactCreates && vueDestroys >= vueCreates,
            );
            return snapshot();
        },
        setReadonly: (value: boolean) => {
            setReactReadonly?.(value);
            if (vueReadonly !== undefined) vueReadonly.value = value;
        },
        setValue: (value: string) => {
            setReactValue?.(value);
            if (vueValue !== undefined) vueValue.value = value;
        },
        snapshot,
    }),
);

await waitFor(
    () =>
        document.querySelector('[data-testid="react-status"]')?.textContent ===
            'ready' &&
        document.querySelector('[data-testid="vue-status"]')?.textContent ===
            'ready',
);
document.body.dataset.ready = 'true';

function domAttachment(
    framework: string,
    host:
        { readonly current: HTMLElement | null } | Ref<HTMLElement | undefined>,
    destroyed: () => void,
) {
    return {
        id: `${framework}-surface`,
        attach: () => {
            const element = 'current' in host ? host.current : host.value;
            if (element === undefined || element === null) {
                throw new Error(`${framework} host is unavailable.`);
            }
            const surface = document.createElement('div');
            surface.dataset.surface = framework;
            element.append(surface);
            return {
                destroy: () => {
                    surface.remove();
                    destroyed();
                },
            };
        },
    };
}

function snapshot() {
    const reactReady = reactWorkspace?.snapshot.status === 'ready';
    const vueReady = vueWorkspace?.snapshot.status === 'ready';
    return Object.freeze({
        reactCreates,
        reactDestroys,
        reactReadonly: reactReady
            ? reactWorkspace?.editor.state.readonly
            : undefined,
        reactSource: reactWorkspace?.snapshot.lastKnownSource,
        reactSurfaces: document.querySelectorAll('[data-surface="react"]')
            .length,
        vueCreates,
        vueDestroys,
        vueReadonly: vueReady ? vueWorkspace?.editor.state.readonly : undefined,
        vueSource: vueWorkspace?.snapshot.lastKnownSource,
        vueSurfaces: document.querySelectorAll('[data-surface="vue"]').length,
    });
}

async function waitFor(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return;
        await new Promise<void>((resolve) =>
            globalThis.setTimeout(resolve, 10),
        );
    }
    throw new Error('Framework adapter demo timed out.');
}

function requiredElement(id: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(`#${id}`);
    if (element === null) throw new Error(`Missing #${id}.`);
    return element;
}
