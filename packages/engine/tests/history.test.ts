import { Editor } from '@soeditor/core';

import { HistoryPlugin } from '../src/history.js';
import {
    readReplaySelection,
    setHistoryMetadata,
} from '../src/history-metadata.js';
import type { EditingSelection } from '../src/model.js';

describe('transaction-backed history', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('registers deterministic undo and redo commands', async () => {
        const editor = await Editor.create({
            data: '<p>A</p>',
            plugins: [HistoryPlugin],
        });

        expect(editor.commands.canExecute('editor.undo')).toBe(false);
        editor.setData('<p>B</p>');
        editor.setData('<p>C</p>');
        expect(editor.commands.canExecute('editor.undo')).toBe(true);

        expect(editor.execute('editor.undo')).toBe(true);
        expect(editor.getData()).toBe('<p>B</p>');
        expect(editor.execute('editor.undo')).toBe(true);
        expect(editor.getData()).toBe('<p>A</p>');
        expect(editor.commands.canExecute('editor.undo')).toBe(false);
        expect(editor.commands.canExecute('editor.redo')).toBe(true);

        expect(editor.execute('editor.redo')).toBe(true);
        expect(editor.getData()).toBe('<p>B</p>');
        expect(editor.execute('editor.redo')).toBe(true);
        expect(editor.getData()).toBe('<p>C</p>');
        expect(editor.commands.canExecute('editor.redo')).toBe(false);
        await editor.destroy();
    });

    it('invalidates redo after a new committed change', async () => {
        const editor = await Editor.create({
            data: '<p>A</p>',
            plugins: [HistoryPlugin],
        });

        editor.setData('<p>B</p>');
        editor.execute('editor.undo');
        editor.setData('<p>C</p>');

        expect(editor.commands.canExecute('editor.redo')).toBe(false);
        editor.execute('editor.undo');
        expect(editor.getData()).toBe('<p>A</p>');
        await editor.destroy();
    });

    it('groups continuous typing transactions by time and selection', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-29T00:00:00Z'));
        const editor = await Editor.create({
            data: '<p></p>',
            plugins: [HistoryPlugin],
        });

        commitGrouped(editor, '<p>A</p>', collapsed(0), collapsed(1));
        vi.advanceTimersByTime(200);
        commitGrouped(editor, '<p>AB</p>', collapsed(1), collapsed(2));
        vi.advanceTimersByTime(200);
        commitGrouped(editor, '<p>ABC</p>', collapsed(2), collapsed(3));

        editor.execute('editor.undo');
        expect(editor.getData()).toBe('<p></p>');
        expect(editor.commands.canExecute('editor.undo')).toBe(false);
        editor.execute('editor.redo');
        expect(editor.getData()).toBe('<p>ABC</p>');
        await editor.destroy();
    });

    it('breaks groups after a selection discontinuity or timeout', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-29T00:00:00Z'));
        const editor = await Editor.create({
            data: '<p></p>',
            plugins: [HistoryPlugin],
        });

        commitGrouped(editor, '<p>A</p>', collapsed(0), collapsed(1));
        commitGrouped(editor, '<p>BA</p>', collapsed(0), collapsed(1));
        vi.advanceTimersByTime(1_001);
        commitGrouped(editor, '<p>BAC</p>', collapsed(2), collapsed(3));

        editor.execute('editor.undo');
        expect(editor.getData()).toBe('<p>BA</p>');
        editor.execute('editor.undo');
        expect(editor.getData()).toBe('<p>A</p>');
        editor.execute('editor.undo');
        expect(editor.getData()).toBe('<p></p>');
        await editor.destroy();
    });

    it('places structured selection metadata on undo and redo replay', async () => {
        const editor = await Editor.create({
            data: '<p>A</p>',
            plugins: [HistoryPlugin],
        });
        const before = collapsed(1);
        const after = collapsed(2);
        const replayed: (EditingSelection | undefined)[] = [];
        editor.events.on('document:change', ({ transaction }) => {
            const selection = readReplaySelection(transaction);
            if (selection !== undefined) {
                replayed.push(selection);
            }
        });

        commitGrouped(editor, '<p>AB</p>', before, after);
        editor.execute('editor.undo');
        editor.execute('editor.redo');

        expect(replayed).toEqual([before, after]);
        await editor.destroy();
    });

    it('keeps history consistent when a later replay listener throws', async () => {
        const editor = await Editor.create({
            data: '<p>A</p>',
            plugins: [HistoryPlugin],
        });
        editor.setData('<p>B</p>');
        const failure = new Error('observer failed');
        editor.events.on('document:change', ({ transaction }) => {
            if (readReplaySelection(transaction) === undefined) {
                throw failure;
            }
        });

        expect(() => editor.execute('editor.undo')).toThrow(failure);
        expect(editor.getData()).toBe('<p>A</p>');
        expect(editor.commands.canExecute('editor.redo')).toBe(true);
        await editor.destroy();
    });
});

function commitGrouped(
    editor: Editor,
    source: string,
    beforeSelection: EditingSelection,
    afterSelection: EditingSelection,
): void {
    editor.update(
        (transaction) => {
            transaction.replaceDocument(source);
            setHistoryMetadata(transaction, {
                afterSelection,
                beforeSelection,
                group: 'typing',
            });
        },
        { origin: 'user' },
    );
}

function collapsed(offset: number): EditingSelection {
    return {
        anchor: { block: 0, offset },
        focus: { block: 0, offset },
    };
}
