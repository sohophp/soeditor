'use client';

import { createElement, useEffect, useLayoutEffect, useRef } from 'react';
import type {
    ClassicEditor,
    ClassicEditorChange,
    CreateClassicEditorOptions,
} from '@soeditor/editor/cms';

const useClientLayoutEffect =
    typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface SoEditorProps {
    /** Controlled HTML. Echo onChange back into value. */
    readonly value?: string;
    /** Initial HTML and native form reset baseline; read once per mount. */
    readonly defaultValue?: string;
    readonly readonly?: boolean;
    readonly name?: string;
    readonly id?: string;
    readonly className?: string;
    /** Construction options; remount with a React key to change them. */
    readonly options?: Omit<
        CreateClassicEditorOptions,
        | 'data'
        | 'readonly'
        | 'onChange'
        | 'onReady'
        | 'onError'
        | 'onFocus'
        | 'onBlur'
    >;
    /** Supply the cms/optional factory to enable lazy Source. Read once. */
    readonly createEditor?: (
        host: HTMLElement,
        options: CreateClassicEditorOptions,
    ) => Promise<ClassicEditor>;
    readonly onChange?: (html: string, change: ClassicEditorChange) => void;
    readonly onReady?: (editor: ClassicEditor) => void;
    readonly onError?: (error: unknown) => void;
    readonly onFocus?: (editor: ClassicEditor) => void;
    readonly onBlur?: (editor: ClassicEditor) => void;
}

/** CMS textarea adapter. The editor owns its DOM only after client mount. */
export function SoEditor(props: SoEditorProps) {
    const host = useRef<HTMLTextAreaElement>(null);
    const latest = useRef(props);
    const initial = useRef(props.value ?? props.defaultValue ?? '');
    const instance = useRef<ClassicEditor | undefined>(undefined);
    const lifecycle = useRef(Promise.resolve());
    const applying = useRef(false);
    // Commit callback/value updates without exposing abandoned concurrent renders.
    useClientLayoutEffect(() => {
        latest.current = props;
    });
    useEffect(() => {
        const element = host.current;
        if (element === null) return;
        let cancelled = false;
        let mounted: ClassicEditor | undefined;
        const report = (error: unknown) => {
            if (!cancelled) latest.current.onError?.(error);
        };
        const start = lifecycle.current
            .then(async () => {
                if (cancelled) return;
                const configuration = latest.current;
                const create =
                    configuration.createEditor ??
                    (await import('@soeditor/editor/cms')).createClassicEditor;
                if (cancelled) return;
                const created = await create(element, {
                    ...configuration.options,
                    data: configuration.value ?? initial.current,
                    readonly: configuration.readonly ?? false,
                    onChange: (change) => {
                        if (!cancelled && !applying.current)
                            latest.current.onChange?.(change.source, change);
                    },
                    onError: report,
                    onFocus: (editor) => {
                        if (!cancelled) latest.current.onFocus?.(editor);
                    },
                    onBlur: (editor) => {
                        if (!cancelled) latest.current.onBlur?.(editor);
                    },
                });
                if (cancelled) {
                    await created.destroy();
                    return;
                }
                mounted = created;
                instance.current = created;
                try {
                    applying.current = true;
                    if (
                        latest.current.value !== undefined &&
                        latest.current.value !== created.getData()
                    )
                        created.setData(latest.current.value);
                    created.setReadonly(latest.current.readonly ?? false);
                } finally {
                    applying.current = false;
                }
                latest.current.onReady?.(created);
            })
            .catch(report);
        lifecycle.current = start.catch(() => undefined);
        return () => {
            cancelled = true;
            instance.current = undefined;
            lifecycle.current = lifecycle.current
                .then(async () => {
                    await mounted?.destroy();
                })
                .catch((error: unknown) => latest.current.onError?.(error))
                .catch(() => undefined);
        };
    }, []);
    // Apply owner updates during commit, before another native keystroke can
    // arrive. A passive effect can replay an older controlled echo over input.
    useClientLayoutEffect(() => {
        const editor = instance.current;
        if (!editor || editor.destroyed) return;
        try {
            applying.current = true;
            if (props.value !== undefined && props.value !== editor.getData())
                editor.setData(props.value);
            editor.setReadonly(props.readonly ?? false);
        } catch (error: unknown) {
            latest.current.onError?.(error);
        } finally {
            applying.current = false;
        }
    }, [props.value, props.readonly]);
    return createElement(
        'div',
        { className: props.className },
        createElement('textarea', {
            ref: host,
            id: props.id,
            name: props.name,
            defaultValue: initial.current,
            readOnly: true,
            'aria-label': props.options?.ariaLabel,
        }),
    );
}
