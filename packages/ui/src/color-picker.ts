/** Internal HSV controls, loaded with the color menu rather than editor startup. */
export interface HsvaColor {
    readonly h: number;
    readonly s: number;
    readonly v: number;
    readonly a: number;
}

const clamp = (value: number, maximum = 1): number =>
    Math.max(0, Math.min(maximum, value));

export function rgbaToHsva(r: number, g: number, b: number, a = 1): HsvaColor {
    const red = clamp(r, 255) / 255;
    const green = clamp(g, 255) / 255;
    const blue = clamp(b, 255) / 255;
    const maximum = Math.max(red, green, blue);
    const delta = maximum - Math.min(red, green, blue);
    const hue =
        delta === 0
            ? 0
            : maximum === red
              ? ((green - blue) / delta) % 6
              : maximum === green
                ? (blue - red) / delta + 2
                : (red - green) / delta + 4;
    return {
        h: (hue * 60 + 360) % 360,
        s: maximum === 0 ? 0 : delta / maximum,
        v: maximum,
        a: clamp(a),
    };
}

export function hsvaToRgba(
    color: HsvaColor,
): readonly [number, number, number, number] {
    const hue = (((color.h % 360) + 360) % 360) / 60;
    const value = clamp(color.v);
    const chroma = value * clamp(color.s);
    // The RGB channels use the same six hue sectors, offset by two sectors.
    const channel = (offset: number): number => {
        const sector = (offset + hue) % 6;
        return Math.round(
            255 *
                (value - chroma * Math.max(0, Math.min(sector, 4 - sector, 1))),
        );
    };
    return [channel(5), channel(3), channel(1), clamp(color.a)];
}

export function serializePickerColor(color: HsvaColor): string {
    const [r, g, b, a] = hsvaToRgba(color);
    return a < 1
        ? `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
        : '#' +
              [r, g, b]
                  .map((value) => value.toString(16).padStart(2, '0'))
                  .join('');
}

export type ColorFormat = 'HEXA' | 'RGBA' | 'HSVA';

export function formatPickerColor(
    color: HsvaColor,
    format: ColorFormat,
): string {
    const [r, g, b, a] = hsvaToRgba(color);
    const round = (value: number): number => Number(value.toFixed(2));
    if (format === 'HSVA')
        return `hsva(${round(color.h)}, ${round(color.s * 100)}%, ${round(color.v * 100)}%, ${round(a)})`;
    if (format === 'RGBA')
        return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
    return (
        '#' +
        [r, g, b, ...(a < 1 ? [Math.round(a * 255)] : [])]
            .map((value) => value.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
    );
}

/** CSSOM validates names/HSL; computed styles resolve them to sRGB for the picker. */
export function parsePickerColor(
    document: Document,
    value: string,
): HsvaColor | undefined {
    const hsv = value.match(
        /^hsva?\(\s*([+-]?[\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/iu,
    );
    if (hsv) {
        const h = Number(hsv[1]),
            s = Number(hsv[2]) / 100,
            v = Number(hsv[3]) / 100,
            a = Number(hsv[4] ?? 1);
        if (![h, s, v, a].every(Number.isFinite) || s > 1 || v > 1 || a > 1)
            return undefined;
        return { h: ((h % 360) + 360) % 360, s, v, a };
    }
    if (/^#[\da-f]{3,4}$/iu.test(value)) {
        value = '#' + [...value.slice(1)].map((part) => part + part).join('');
    }
    if (/^#[\da-f]{6}(?:[\da-f]{2})?$/iu.test(value)) {
        return rgbaToHsva(
            parseInt(value.slice(1, 3), 16),
            parseInt(value.slice(3, 5), 16),
            parseInt(value.slice(5, 7), 16),
            value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1,
        );
    }
    const probe = document.createElement('span');
    probe.style.color = value;
    if (probe.style.color === '') return undefined;
    probe.hidden = true;
    document.documentElement.append(probe);
    const resolved = document.defaultView?.getComputedStyle(probe).color;
    probe.remove();
    const parts = resolved?.match(
        /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/u,
    );
    return parts
        ? rgbaToHsva(
              Number(parts[1]),
              Number(parts[2]),
              Number(parts[3]),
              Number(parts[4] ?? 1),
          )
        : undefined;
}

export function createColorPicker(
    document: Document,
    translate: (key: string) => string,
    change: (value: string, color: HsvaColor) => void,
): {
    readonly element: HTMLElement;
    setColor(value: string): void;
    setDisabled(disabled: boolean): void;
    destroy(): void;
} {
    let color: HsvaColor = { h: 0, s: 0, v: 0, a: 1 };
    const controller = new AbortController();
    function listen<K extends keyof HTMLElementEventMap>(
        target: HTMLElement,
        type: K,
        listener: (event: HTMLElementEventMap[K]) => void,
    ): void {
        target.addEventListener(type, listener, { signal: controller.signal });
    }
    function make<K extends keyof HTMLElementTagNameMap>(
        tag: K,
        suffix: string,
    ): HTMLElementTagNameMap[K] {
        const node = document.createElement(tag);
        node.className = 'soeditor-ui__' + suffix;
        return node;
    }

    const element = make('div', 'spectrum');
    const plane = document.createElement('button');
    plane.type = 'button';
    plane.className = 'soeditor-ui__color-plane';
    plane.setAttribute('role', 'slider');
    plane.setAttribute('aria-label', translate('Saturation and brightness'));
    plane.setAttribute(
        'aria-description',
        translate(
            'Left and right adjust saturation; up and down adjust brightness.',
        ),
    );
    plane.setAttribute('aria-valuemin', '0');
    plane.setAttribute('aria-valuemax', '100');
    const handle = make('span', 'color-handle');
    handle.setAttribute('aria-hidden', 'true');
    plane.append(handle);
    const makeRange = (
        label: string,
        className: string,
        max: number,
    ): HTMLInputElement => {
        const wrapper = make('label', 'spectrum-row');
        const text = document.createElement('span');
        text.textContent = translate(label);
        const input = document.createElement('input');
        input.type = 'range';
        input.max = String(max);
        input.className = className;
        input.setAttribute('aria-label', translate(label));
        wrapper.append(text, input);
        element.append(wrapper);
        return input;
    };
    element.append(plane);
    const hue = makeRange('Hue', 'soeditor-ui__hue-slider', 360);
    const opacity = makeRange('Opacity', 'soeditor-ui__opacity-slider', 100);
    const render = (): void => {
        element.style.setProperty(
            '--soeditor-picker-hue',
            `hsl(${color.h}, 100%, 50%)`,
        );
        element.style.setProperty(
            '--soeditor-picker-opaque',
            serializePickerColor({ ...color, a: 1 }),
        );
        handle.style.left = `${color.s * 100}%`;
        handle.style.top = `${(1 - color.v) * 100}%`;
        plane.setAttribute('aria-valuenow', String(Math.round(color.s * 100)));
        plane.setAttribute(
            'aria-valuetext',
            translate('Saturation {s}%, brightness {v}%')
                .replace('{s}', String(Math.round(color.s * 100)))
                .replace('{v}', String(Math.round(color.v * 100))),
        );
        hue.value = String(Math.round(color.h));
        opacity.value = String(Math.round(color.a * 100));
    };
    const commitDraft = (): void => {
        render();
        change(serializePickerColor(color), color);
    };
    let pointer: number | undefined;
    const move = (event: PointerEvent): void => {
        if (event.pointerId !== pointer || plane.disabled) return;
        const bounds = plane.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) return;
        color = {
            ...color,
            s: clamp((event.clientX - bounds.left) / bounds.width),
            v: clamp(1 - (event.clientY - bounds.top) / bounds.height),
        };
        commitDraft();
    };
    const down = (event: PointerEvent): void => {
        if (plane.disabled || !event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        plane.focus({ preventScroll: true });
        pointer = event.pointerId;
        plane.setPointerCapture(pointer);
        move(event);
    };
    const end = (event: PointerEvent): void => {
        if (pointer !== event.pointerId) return;
        if (plane.hasPointerCapture(pointer))
            plane.releasePointerCapture(pointer);
        pointer = undefined;
    };
    const key = (event: KeyboardEvent): void => {
        const step = event.shiftKey ? 0.1 : 0.01;
        let { s, v } = color;
        switch (event.key) {
            case 'ArrowLeft':
                s -= step;
                break;
            case 'ArrowRight':
                s += step;
                break;
            case 'ArrowUp':
                v += step;
                break;
            case 'ArrowDown':
                v -= step;
                break;
            case 'Home':
                s = 0;
                break;
            case 'End':
                s = 1;
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
        color = { ...color, s: clamp(s), v: clamp(v) };
        commitDraft();
    };
    const hueInput = (): void => {
        // Reveal the chosen hue when the current color is black, white or gray.
        // Otherwise changing hue alone cannot change its RGB/HEX value.
        color = {
            ...color,
            h: Number(hue.value),
            s: color.s || 1,
            v: color.v || 1,
        };
        commitDraft();
    };
    const opacityInput = (): void => {
        color = { ...color, a: Number(opacity.value) / 100 };
        commitDraft();
    };
    listen(plane, 'pointerdown', down);
    listen(plane, 'pointermove', move);
    listen(plane, 'pointerup', end);
    listen(plane, 'pointercancel', end);
    listen(plane, 'lostpointercapture', end);
    listen(plane, 'keydown', key);
    listen(hue, 'input', hueInput);
    listen(opacity, 'input', opacityInput);
    render();
    return {
        element,
        setColor(value) {
            const parsed = parsePickerColor(document, value);
            if (!parsed) return;
            // Grayscale/black must not reset the hue while typing or reopening.
            color = {
                ...parsed,
                h: parsed.s === 0 || parsed.v === 0 ? color.h : parsed.h,
            };
            render();
        },
        setDisabled(disabled) {
            plane.disabled = disabled;
            hue.disabled = disabled;
            opacity.disabled = disabled;
        },
        destroy() {
            if (pointer !== undefined && plane.hasPointerCapture(pointer))
                plane.releasePointerCapture(pointer);
            pointer = undefined;
            controller.abort();
        },
    };
}
