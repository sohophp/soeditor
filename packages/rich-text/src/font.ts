import { Plugin } from '@soeditor/core';
import {
    StructuredEditingPlugin,
    visualEditingServiceToken,
    type VisualEditingService,
} from '@soeditor/engine';

import { RichTextArgumentError } from './features.js';

export type FontStyleCommand =
    | 'font.backgroundColor'
    | 'font.color'
    | 'font.family'
    | 'font.highlight'
    | 'font.size';

export type FontStyleRemovalCommand =
    | 'font.backgroundColor.remove'
    | 'font.color.remove'
    | 'font.highlight.remove';

/** Command-backed font family, size, color, background, and highlight formatting. */
export class FontPlugin extends Plugin {
    static readonly id = 'font';
    static readonly requires = [StructuredEditingPlugin];

    override init(): void {
        this.#register('font.color', 'color', readColor);
        this.#register('font.backgroundColor', 'background-color', readColor);
        this.#register('font.highlight', 'background-color', readColor);
        this.#register('font.family', 'font-family', readFontFamily);
        this.#register('font.size', 'font-size', readFontSize);
        this.#registerRemoval('font.color.remove', 'color');
        this.#registerRemoval(
            'font.backgroundColor.remove',
            'background-color',
        );
        this.#registerRemoval('font.highlight.remove', 'background-color');
    }

    #register(
        command: FontStyleCommand,
        property: 'background-color' | 'color' | 'font-family' | 'font-size',
        validate: (command: FontStyleCommand, value: unknown) => string,
    ): void {
        this.editor.commands.register({
            id: command,
            label:
                command === 'font.color'
                    ? 'Text color'
                    : command === 'font.backgroundColor'
                      ? 'Background color'
                      : command === 'font.highlight'
                        ? 'Highlight'
                        : command === 'font.family'
                          ? 'Font family'
                          : 'Font size',
            canExecute: ({ editor }) => {
                const service = editor.services.tryGet(
                    visualEditingServiceToken,
                );
                return (
                    service?.canEdit() === true &&
                    service.applyInlineStyle !== undefined
                );
            },
            execute: ({ editor }, ...args) => {
                if (args.length !== 1) {
                    throw new RichTextArgumentError(
                        command,
                        'requires exactly one value.',
                    );
                }
                const value = validate(command, args[0]);
                requireFontService(
                    editor.services.get(visualEditingServiceToken),
                    command,
                ).applyInlineStyle?.({
                    attributes: Object.freeze([
                        Object.freeze({
                            name: 'style',
                            value: `${property}: ${value};`,
                        }),
                    ]),
                    tagName: 'span',
                });
            },
        });
    }

    #registerRemoval(
        command: FontStyleRemovalCommand,
        property: 'background-color' | 'color',
    ): void {
        this.editor.commands.register({
            id: command,
            label:
                property === 'color'
                    ? 'Remove text color'
                    : 'Remove background color',
            canExecute: ({ editor }) => {
                const service = editor.services.tryGet(
                    visualEditingServiceToken,
                );
                return (
                    service?.canEdit() === true &&
                    service.removeInlineStyleProperty !== undefined
                );
            },
            execute: ({ editor }) => {
                const service = editor.services.get(visualEditingServiceToken);
                if (
                    !service.canEdit() ||
                    service.removeInlineStyleProperty === undefined
                ) {
                    throw new Error(
                        `Command "${command}" requires removable inline styles.`,
                    );
                }
                service.removeInlineStyleProperty(property);
            },
        });
    }
}

function requireFontService(
    service: VisualEditingService,
    command: FontStyleCommand,
): VisualEditingService {
    if (!service.canEdit() || service.applyInlineStyle === undefined) {
        throw new Error(
            `Command "${command}" requires an editable visual surface.`,
        );
    }
    return service;
}

function readColor(command: FontStyleCommand, value: unknown): string {
    if (typeof value !== 'string') {
        throw new RichTextArgumentError(
            command,
            'requires a CSS color string.',
        );
    }
    const normalized = value.trim().toLowerCase();
    if (
        normalized.length === 0 ||
        normalized.length > 80 ||
        !(
            /^#[\da-f]{3,8}$/u.test(normalized) ||
            /^(?:rgb|hsl)a?\([\d.% ,+-]+\)$/u.test(normalized) ||
            /^[a-z]+$/u.test(normalized)
        )
    ) {
        throw new RichTextArgumentError(
            command,
            'received an unsafe CSS color.',
        );
    }
    return normalized;
}

const supportedFontFamilies = new Set([
    'inherit',
    'arial',
    'courier new',
    'georgia',
    'lucida sans unicode',
    'tahoma',
    'times new roman',
    'trebuchet ms',
    'verdana',
    'sans-serif',
    'serif',
    'monospace',
]);

function readFontFamily(command: FontStyleCommand, value: unknown): string {
    const normalized =
        typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (supportedFontFamilies.has(normalized)) return normalized;
    throw new RichTextArgumentError(
        command,
        'requires one of the supported font-family presets.',
    );
}

function readFontSize(command: FontStyleCommand, value: unknown): string {
    const normalized =
        typeof value === 'number' && Number.isFinite(value)
            ? `${String(value)}px`
            : typeof value === 'string'
              ? value.trim().toLowerCase()
              : '';
    const pixels = /^(\d+(?:\.\d+)?)px$/u.exec(normalized);
    if (pixels?.[1] !== undefined) {
        const number = Number(pixels[1]);
        if (number >= 8 && number <= 96) return `${String(number)}px`;
    }
    const relative = /^(\d+(?:\.\d+)?)(em|rem|%)$/u.exec(normalized);
    if (relative?.[1] !== undefined && relative[2] !== undefined) {
        const number = Number(relative[1]);
        if (
            (relative[2] === '%' && number >= 50 && number <= 400) ||
            (relative[2] !== '%' && number >= 0.5 && number <= 6)
        ) {
            return `${String(number)}${relative[2]}`;
        }
    }
    if (
        [
            'xx-small',
            'x-small',
            'small',
            'medium',
            'large',
            'x-large',
            'xx-large',
        ].includes(normalized)
    ) {
        return normalized;
    }
    throw new RichTextArgumentError(
        command,
        'requires 8–96px, 0.5–6em/rem, 50–400%, or a standard size keyword.',
    );
}
