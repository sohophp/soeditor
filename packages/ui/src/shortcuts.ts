import type { KeyboardShortcutDefinition } from './types.js';

const MODIFIERS = new Set(['Alt', 'Mod', 'Shift']);

export interface ParsedShortcut {
    readonly alt: boolean;
    readonly chord: string;
    readonly key: string;
    readonly mod: boolean;
    readonly shift: boolean;
}

export function parseShortcut(chord: string): ParsedShortcut {
    const parts = chord
        .split('+')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    const rawKey = parts.at(-1);
    if (rawKey === undefined || MODIFIERS.has(rawKey)) {
        throw new TypeError(
            `Keyboard shortcut chord "${chord}" must include a non-modifier key.`,
        );
    }
    const modifiers = parts.slice(0, -1);
    if (
        modifiers.some((modifier) => !MODIFIERS.has(modifier)) ||
        new Set(modifiers).size !== modifiers.length
    ) {
        throw new TypeError(`Keyboard shortcut chord "${chord}" is invalid.`);
    }
    const key = normalizeKey(rawKey);
    const alt = modifiers.includes('Alt');
    const mod = modifiers.includes('Mod');
    const shift = modifiers.includes('Shift');
    return Object.freeze({
        alt,
        chord: [
            ...(mod ? ['Mod'] : []),
            ...(alt ? ['Alt'] : []),
            ...(shift ? ['Shift'] : []),
            key.length === 1 ? key.toUpperCase() : key,
        ].join('+'),
        key,
        mod,
        shift,
    });
}

export function matchesShortcut(
    shortcut: ParsedShortcut,
    event: KeyboardEvent,
): boolean {
    const hasMod = event.ctrlKey || event.metaKey;
    return (
        !event.isComposing &&
        normalizeKey(event.key) === shortcut.key &&
        event.altKey === shortcut.alt &&
        event.shiftKey === shortcut.shift &&
        hasMod === shortcut.mod
    );
}

export function freezeShortcut(
    definition: KeyboardShortcutDefinition,
): KeyboardShortcutDefinition & { readonly parsed: ParsedShortcut } {
    if (
        typeof definition !== 'object' ||
        definition === null ||
        typeof definition.id !== 'string' ||
        definition.id.trim().length === 0
    ) {
        throw new TypeError('A keyboard shortcut ID must not be empty.');
    }
    if (
        typeof definition.command !== 'string' ||
        definition.command.trim().length === 0
    ) {
        throw new TypeError('A keyboard shortcut command must not be empty.');
    }
    if (definition.args !== undefined && !Array.isArray(definition.args)) {
        throw new TypeError('Keyboard shortcut arguments must be an array.');
    }
    if (typeof definition.chord !== 'string') {
        throw new TypeError('A keyboard shortcut chord must be a string.');
    }
    const parsed = parseShortcut(definition.chord);
    return Object.freeze({
        id: definition.id,
        chord: parsed.chord,
        command: definition.command,
        args: Object.freeze([...(definition.args ?? [])]),
        parsed,
    });
}

function normalizeKey(key: string): string {
    return key.length === 1 ? key.toLowerCase() : key;
}
