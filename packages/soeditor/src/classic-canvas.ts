export type ClassicCanvasPresetId =
    | 'webpage'
    | 'mobile'
    | 'mobile-wide'
    | 'ipad'
    | 'ipad-landscape'
    | 'desktop'
    | 'macbook'
    | 'desktop-wide'
    | 'full-hd'
    | 'email'
    | 'word';

export interface ClassicCanvasPreset {
    readonly id: string;
    readonly label: string;
    /** CSS length in px, rem, em, mm, cm, in or %. */
    readonly width: string;
    /** False keeps the exact width and allows horizontal scrolling. */
    readonly fitToContainer?: boolean;
    readonly minHeight?: string;
    readonly padding?: string;
}

export interface ClassicCanvasOptions {
    readonly initialPreset?: string;
    /** Instance-owned choices; omitted includes the built-in device and document widths. */
    readonly presets?: readonly (ClassicCanvasPresetId | ClassicCanvasPreset)[];
    readonly showSelector?: boolean;
}

export function createClassicCanvas(
    visual: HTMLElement,
    content: HTMLElement,
    options: ClassicCanvasOptions,
): {
    readonly preset: string;
    select(id: string): void;
    mount(host: HTMLElement, translate: (text: string) => string): void;
    destroy(): void;
} {
    const presets = new Map(
        resolveClassicCanvasPresets(options).map((preset) => [
            preset.id,
            preset,
        ]),
    );
    const initial = options.initialPreset ?? presets.keys().next().value;
    if (initial === undefined || !presets.has(initial))
        throw new TypeError(
            'The initial canvas preset must be an available choice.',
        );
    let selected: string = initial;
    let selector: HTMLSelectElement | undefined;
    let label: HTMLLabelElement | undefined;
    const select = (id: string): void => {
        const preset = presets.get(id);
        if (!preset) throw new TypeError(`Unknown canvas preset: ${id}`);
        selected = id;
        visual.dataset.canvasPreset = id;
        visual.style.background =
            id === 'webpage'
                ? 'var(--soeditor-bg, #fff)'
                : 'var(--soeditor-panel-bg, #f1f3f5)';
        Object.assign(content.style, {
            boxSizing: 'border-box',
            width:
                preset.fitToContainer === false
                    ? preset.width
                    : `min(100%, ${preset.width})`,
            minHeight: preset.minHeight,
            padding: preset.padding,
            marginInline: 'auto',
            background: 'var(--soeditor-bg, #fff)',
        });
        if (selector) selector.value = id;
    };
    select(selected);
    return {
        get preset() {
            return selected;
        },
        select,
        mount(host, translate) {
            if (options.showSelector === false || label) return;
            label = visual.ownerDocument.createElement('label');
            label.className = 'soeditor-classic__canvas-control';
            label.append(translate('Editing size'), ' ');
            selector = visual.ownerDocument.createElement('select');
            selector.className = 'soeditor-ui__dialog-action';
            selector.setAttribute('aria-label', translate('Editing size'));
            for (const preset of presets.values()) {
                const option = visual.ownerDocument.createElement('option');
                option.value = preset.id;
                option.textContent =
                    typeof (options.presets ?? []).find(
                        (choice) =>
                            typeof choice !== 'string' &&
                            choice.id === preset.id,
                    ) === 'object'
                        ? preset.label
                        : translate(preset.label);
                selector.append(option);
            }
            selector.value = selected;
            selector.addEventListener('change', () => select(selector!.value));
            label.append(selector);
            host.append(label);
        },
        destroy() {
            label?.remove();
        },
    };
}

export function resolveClassicCanvasPresets(
    options: ClassicCanvasOptions = {},
): readonly ClassicCanvasPreset[] {
    const builtins: Record<ClassicCanvasPresetId, ClassicCanvasPreset> = {
        webpage: {
            id: 'webpage',
            label: 'Responsive · 100%',
            width: '100%',
            padding: '24px',
        },
        mobile: {
            id: 'mobile',
            label: 'Phone · 390px',
            width: '390px',
            padding: '24px',
            fitToContainer: false,
        },
        'mobile-wide': {
            id: 'mobile-wide',
            label: 'Large phone · 430px',
            width: '430px',
            padding: '24px',
            fitToContainer: false,
        },
        ipad: {
            id: 'ipad',
            label: 'iPad portrait · 768px',
            width: '768px',
            padding: '24px',
            fitToContainer: false,
        },
        'ipad-landscape': {
            id: 'ipad-landscape',
            label: 'iPad landscape · 1024px',
            width: '1024px',
            padding: '24px',
            fitToContainer: false,
        },
        desktop: {
            id: 'desktop',
            label: 'PC · 1200px',
            width: '1200px',
            padding: '24px',
            fitToContainer: false,
        },
        macbook: {
            id: 'macbook',
            label: 'Mac laptop · 1280px',
            width: '1280px',
            padding: '24px',
            fitToContainer: false,
        },
        'desktop-wide': {
            id: 'desktop-wide',
            label: 'Desktop · 1440px',
            width: '1440px',
            padding: '24px',
            fitToContainer: false,
        },
        'full-hd': {
            id: 'full-hd',
            label: 'Large desktop · 1920px',
            width: '1920px',
            padding: '24px',
            fitToContainer: false,
        },
        email: {
            id: 'email',
            label: 'Email newsletter · 600px',
            width: '600px',
            padding: '28px',
        },
        word: {
            id: 'word',
            label: 'Word · A4 210 × 297mm',
            width: '210mm',
            minHeight: '297mm',
            padding: '25.4mm',
        },
    };
    const length = (value: string): string => {
        if (!/^(?:0|(?:\d+(?:\.\d+)?)(?:px|rem|em|mm|cm|in|%))$/u.test(value))
            throw new TypeError(
                'Canvas dimensions must be non-negative CSS lengths.',
            );
        return value;
    };
    const presets = new Map<string, ClassicCanvasPreset>();
    for (const choice of options.presets ??
        (Object.keys(builtins) as ClassicCanvasPresetId[])) {
        const value = typeof choice === 'string' ? builtins[choice] : choice;
        if (
            !value ||
            !value.id.trim() ||
            !value.label.trim() ||
            presets.has(value.id)
        )
            throw new TypeError('Canvas presets need unique IDs and labels.');
        presets.set(value.id, {
            ...value,
            width: length(value.width),
            padding: length(value.padding ?? '24px'),
            minHeight: length(value.minHeight ?? '100%'),
        });
    }
    return [...presets.values()];
}
