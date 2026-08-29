import {
    Editor,
    StaleTransactionError,
    type Transaction,
    TransactionAlreadyCommittedError,
    TransactionOwnershipError,
} from '../src/index';

describe('Transaction', () => {
    it('builds operations and immutable metadata snapshots', async () => {
        const input = { nested: { enabled: true } };
        const editor = await Editor.create();
        const transaction = editor
            .createTransaction({ origin: 'command' })
            .replaceDocument('next')
            .setMode('preview')
            .setMeta('input', input)
            .setMeta('count', 2);

        input.nested.enabled = false;

        expect(transaction.origin).toBe('command');
        expect(transaction.operations).toEqual([
            { type: 'replace-document', source: 'next' },
            { type: 'set-mode', mode: 'preview' },
        ]);
        expect(transaction.getMeta('input')).toBe(input);
        expect(transaction.getMeta('missing')).toBeUndefined();
        expect(transaction.metadata).toEqual({
            input: { nested: { enabled: false } },
            count: 2,
        });
        expect(Object.isFrozen(transaction.metadata)).toBe(true);
    });

    it('dispatches replacement and mode changes as one state transition', async () => {
        const editor = await Editor.create({ data: 'before' });
        const previous = editor.state;
        const transaction = editor
            .createTransaction({ origin: 'user' })
            .replaceDocument('after')
            .setMode('source');

        editor.dispatch(transaction);

        expect(editor.state).not.toBe(previous);
        expect(editor.state.document.source).toBe('after');
        expect(editor.state.document.revision).toBe(1);
        expect(editor.state.mode).toBe('source');
        expect(editor.state.dirty).toBe(true);
    });

    it('uses the final source and increments revision once per dispatch', async () => {
        const editor = await Editor.create({ data: 'start' });
        editor.update((transaction) => {
            transaction.replaceDocument('middle').replaceDocument('final');
        });

        expect(editor.getData()).toBe('final');
        expect(editor.state.document.revision).toBe(1);
    });

    it('does not change state, revision, or events for no-op transactions', async () => {
        const editor = await Editor.create({ data: 'same' });
        const initial = editor.state;
        const events: string[] = [];
        editor.events.on('document:change', () => events.push('document'));
        editor.events.on('state:change', () => events.push('state'));

        editor.update((transaction) => transaction.replaceDocument('same'));
        editor.dispatch(editor.createTransaction());

        expect(editor.state).toBe(initial);
        expect(editor.state.document.revision).toBe(0);
        expect(events).toEqual([]);
    });

    it('does not increment document revision for mode-only changes', async () => {
        const editor = await Editor.create({ data: 'same' });
        const document = editor.state.document;
        const changes: string[] = [];
        editor.events.on('mode:change', () => changes.push('mode'));
        editor.events.on('document:change', () => changes.push('document'));

        editor.update((transaction) => transaction.setMode('preview'));

        expect(editor.state.document).toBe(document);
        expect(editor.state.document.revision).toBe(0);
        expect(editor.state.mode).toBe('preview');
        expect(changes).toEqual(['mode']);
    });

    it('emits document and state events in deterministic order', async () => {
        const editor = await Editor.create({ data: 'before' });
        const order: string[] = [];
        editor.events.on('document:beforeChange', ({ previous, current }) => {
            order.push(`before:${previous.source}:${current.source}`);
            expect(editor.getData()).toBe('before');
        });
        editor.events.on('document:change', () => order.push('document'));
        editor.events.on('mode:change', () => order.push('mode'));
        editor.events.on('state:change', ({ transaction }) => {
            order.push(`state:${transaction?.origin}`);
        });

        editor.update(
            (transaction) =>
                transaction.replaceDocument('after').setMode('source'),
            { origin: 'plugin' },
        );

        expect(order).toEqual([
            'before:before:after',
            'document',
            'mode',
            'state:plugin',
        ]);
    });

    it('rejects transaction reuse and mutation after commit', async () => {
        const editor = await Editor.create();
        const transaction = editor.createTransaction().replaceDocument('next');
        editor.dispatch(transaction);

        expect(() => editor.dispatch(transaction)).toThrow(
            TransactionAlreadyCommittedError,
        );
        expect(() => transaction.setMode('source')).toThrow(
            TransactionAlreadyCommittedError,
        );
    });

    it('rejects cross-editor transaction dispatch', async () => {
        const first = await Editor.create();
        const second = await Editor.create();
        const transaction = first.createTransaction().replaceDocument('next');

        expect(() => second.dispatch(transaction)).toThrow(
            TransactionOwnershipError,
        );
        expect(first.getData()).toBe('');
        expect(second.getData()).toBe('');
    });

    it('rejects transactions based on stale state', async () => {
        const editor = await Editor.create();
        const stale = editor.createTransaction().replaceDocument('stale');
        editor.setData('current');

        expect(() => editor.dispatch(stale)).toThrow(StaleTransactionError);
        expect(editor.getData()).toBe('current');
    });

    it('rejects structurally fabricated transactions', async () => {
        const editor = await Editor.create();
        const fabricated: Transaction = {
            origin: 'system',
            operations: [],
            metadata: {},
            replaceDocument() {
                return this;
            },
            setMode() {
                return this;
            },
            setMeta() {
                return this;
            },
            getMeta() {
                return undefined;
            },
        };

        expect(() => editor.dispatch(fabricated)).toThrow(
            TransactionOwnershipError,
        );
    });
});
