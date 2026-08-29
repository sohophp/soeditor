import {
    Editor,
    EditorDestroyedError,
    Plugin,
    ReentrantDispatchError,
    UnsupportedDocumentFormatError,
} from '../src/index';

describe('Editor', () => {
    it('creates the expected immutable initial state', async () => {
        const editor = await Editor.create({
            data: '<p>Hello</p>',
            mode: 'source',
            readonly: true,
        });

        expect(editor.getData()).toBe('<p>Hello</p>');
        expect(editor.state).toEqual({
            document: {
                format: 'html',
                source: '<p>Hello</p>',
                revision: 0,
                metadata: {},
            },
            mode: 'source',
            readonly: true,
            dirty: false,
        });
        expect(Object.isFrozen(editor.state)).toBe(true);
        expect(Object.isFrozen(editor.state.document)).toBe(true);
        expect(Object.isFrozen(editor.state.document.metadata)).toBe(true);
    });

    it('defaults to an empty HTML document in visual mode', async () => {
        const editor = await Editor.create();

        expect(editor.state.document.format).toBe('html');
        expect(editor.state.mode).toBe('visual');
        expect(editor.getData()).toBe('');
    });

    it('creates canonical markdown documents in markdown mode', async () => {
        const editor = await Editor.create({
            data: '# Markdown',
            format: 'markdown',
        });

        expect(editor.state.document.format).toBe('markdown');
        expect(editor.state.mode).toBe('markdown');
        expect(editor.getData()).toBe('# Markdown');
    });

    it('rejects unknown document formats at runtime', async () => {
        await expect(
            Editor.create({
                format: 'unknown' as unknown as 'html',
            }),
        ).rejects.toThrow(UnsupportedDocumentFormatError);
    });

    it('keeps registries independent between instances', async () => {
        const first = await Editor.create();
        const second = await Editor.create();
        first.services.register('example', 1);
        first.commands.register({ id: 'example', execute: () => 1 });

        expect(first.services.has('example')).toBe(true);
        expect(second.services.has('example')).toBe(false);
        expect(second.commands.has('example')).toBe(false);
    });

    it('sets data through a source transaction', async () => {
        const editor = await Editor.create({ data: 'before' });
        let origin: string | undefined;
        editor.events.on('document:change', ({ transaction }) => {
            origin = transaction.origin;
        });

        editor.setData('after');

        expect(editor.getData()).toBe('after');
        expect(editor.state.document.revision).toBe(1);
        expect(editor.state.dirty).toBe(true);
        expect(origin).toBe('source');
    });

    it('marks dirty state clean without changing revision', async () => {
        const editor = await Editor.create({ data: 'before' });
        const changes: boolean[] = [];
        editor.events.on('state:change', ({ current }) => {
            changes.push(current.dirty);
        });
        editor.setData('after');
        const revision = editor.state.document.revision;

        editor.markClean();
        editor.markClean();

        expect(editor.state.dirty).toBe(false);
        expect(editor.state.document.revision).toBe(revision);
        expect(changes).toEqual([true, false]);
    });

    it('allows administrative setData while readonly is true', async () => {
        const editor = await Editor.create({ data: 'before', readonly: true });

        editor.setData('after');

        expect(editor.state.readonly).toBe(true);
        expect(editor.getData()).toBe('after');
        expect(editor.state.dirty).toBe(true);
    });

    it('changes readonly policy without changing the document revision', async () => {
        const editor = await Editor.create({ data: 'before' });
        const changes: boolean[] = [];
        editor.events.on('state:change', ({ current }) => {
            changes.push(current.readonly);
        });

        editor.setReadonly(true);
        editor.setReadonly(true);
        editor.setReadonly(false);

        expect(editor.state.document.revision).toBe(0);
        expect(editor.state.dirty).toBe(false);
        expect(changes).toEqual([true, false]);
        expect(() => editor.setReadonly('yes' as unknown as boolean)).toThrow(
            TypeError,
        );
    });

    it('emits ready and destroy events through plugin-visible setup', async () => {
        const events: string[] = [];

        class ObserverPlugin extends Plugin {
            static readonly id = 'observer';

            override init(): void {
                this.editor.events.on('editor:ready', () =>
                    events.push('ready'),
                );
                this.editor.events.on('editor:destroy', () =>
                    events.push('destroy'),
                );
            }
        }

        const editor = await Editor.create({ plugins: [ObserverPlugin] });
        await editor.destroy();
        await editor.destroy();

        expect(events).toEqual(['ready', 'destroy']);
    });

    it('clears registries and rejects active APIs after destruction', async () => {
        const editor = await Editor.create();
        editor.commands.register({ id: 'demo', execute: () => undefined });
        editor.services.register('demo', {});
        const transaction = editor.createTransaction();
        await editor.destroy();

        expect(() => editor.commands.has('demo')).toThrow(EditorDestroyedError);
        expect(() => editor.services.has('demo')).toThrow(EditorDestroyedError);
        expect(() => editor.execute('demo')).toThrow(EditorDestroyedError);
        expect(() => editor.setData('value')).toThrow(EditorDestroyedError);
        expect(() => editor.update(() => undefined)).toThrow(
            EditorDestroyedError,
        );
        expect(() => editor.dispatch(transaction)).toThrow(
            EditorDestroyedError,
        );
        expect(() => editor.createTransaction()).toThrow(EditorDestroyedError);
        expect(() => editor.markClean()).toThrow(EditorDestroyedError);
        expect(() => editor.setReadonly(true)).toThrow(EditorDestroyedError);
        expect(editor.getData()).toBe('');
        expect(() => editor.commands.get('demo')).toThrow(EditorDestroyedError);
        expect(() =>
            editor.commands.register({ id: 'new', execute: () => 1 }),
        ).toThrow(EditorDestroyedError);
        expect(() => editor.services.register('new', {})).toThrow(
            EditorDestroyedError,
        );
        expect(() => editor.plugins.has('missing')).toThrow(
            EditorDestroyedError,
        );
        expect('emit' in editor.events).toBe(false);
    });

    it('completes cleanup when an editor:destroy listener throws', async () => {
        const editor = await Editor.create();
        const listenerFailure = new Error('destroy listener failed');
        const reported: unknown[] = [];
        editor.commands.register({ id: 'demo', execute: () => undefined });
        editor.services.register('demo', {});
        editor.events.on('editor:destroy', () => {
            throw listenerFailure;
        });
        editor.events.on('event:error', ({ eventName, error }) => {
            expect(eventName).toBe('editor:destroy');
            reported.push(error);
        });

        await expect(editor.destroy()).resolves.toBeUndefined();

        expect(reported).toEqual([listenerFailure]);
        expect(() => editor.commands.has('demo')).toThrow(EditorDestroyedError);
        expect(() => editor.services.has('demo')).toThrow(EditorDestroyedError);
    });

    it('shares one pending destroy operation between concurrent calls', async () => {
        let finishDestroy: (() => void) | undefined;
        let destroyCalls = 0;

        class AsyncPlugin extends Plugin {
            static readonly id = 'async';
            override async destroy(): Promise<void> {
                destroyCalls += 1;
                await new Promise<void>((resolve) => {
                    finishDestroy = resolve;
                });
            }
        }

        const editor = await Editor.create({ plugins: [AsyncPlugin] });
        const first = editor.destroy();
        const second = editor.destroy();

        expect(second).toBe(first);
        expect(destroyCalls).toBe(1);
        expect(() => editor.commands.has('anything')).toThrow(
            EditorDestroyedError,
        );
        finishDestroy?.();
        await Promise.all([first, second]);
        expect(destroyCalls).toBe(1);
    });

    it('establishes the shared destroy promise before plugin cleanup starts', async () => {
        const order: string[] = [];
        let pluginDestroy: Promise<void> | undefined;
        let listenerDestroy: Promise<void> | undefined;
        let destroyCalls = 0;

        class ReentrantPlugin extends Plugin {
            static readonly id = 'reentrant';

            override destroy(): void {
                destroyCalls += 1;
                order.push('plugin:destroy');
                pluginDestroy = this.editor.destroy();
            }
        }

        const editor = await Editor.create({ plugins: [ReentrantPlugin] });
        editor.events.on('editor:destroy', () => {
            order.push('editor:destroy');
            listenerDestroy = editor.destroy();
        });

        const outerDestroy = editor.destroy();

        expect(pluginDestroy).toBe(outerDestroy);
        await outerDestroy;
        expect(listenerDestroy).toBe(outerDestroy);
        expect(editor.destroy()).toBe(outerDestroy);
        expect(destroyCalls).toBe(1);
        expect(order).toEqual(['plugin:destroy', 'editor:destroy']);
        expect(() => editor.commands.has('anything')).toThrow(
            EditorDestroyedError,
        );
    });

    it('exposes event subscription without runtime publishing capability', async () => {
        const editor = await Editor.create();

        expect(Object.isFrozen(editor.events)).toBe(true);
        expect(Object.keys(editor.events).sort()).toEqual(['on', 'once']);
        expect('emit' in editor.events).toBe(false);
        expect('clear' in editor.events).toBe(false);
        expect('notify' in editor.events).toBe(false);
    });

    it.each([
        'document:beforeChange',
        'document:change',
        'state:change',
        'mode:change',
    ] as const)('rejects reentrant dispatch from %s', async (eventName) => {
        const editor = await Editor.create({ data: 'initial' });
        let observed: unknown;
        editor.events.on(eventName, () => {
            try {
                editor.setData('nested');
            } catch (error: unknown) {
                observed = error;
            }
        });

        if (eventName === 'mode:change') {
            editor.update((transaction) => transaction.setMode('source'));
            expect(editor.state.mode).toBe('source');
            expect(editor.getData()).toBe('initial');
        } else {
            editor.setData('outer');
            expect(editor.getData()).toBe('outer');
        }

        expect(observed).toBeInstanceOf(ReentrantDispatchError);
    });

    it('attempts every required post-commit notification after a listener failure', async () => {
        const editor = await Editor.create({ data: 'before' });
        const failure = new Error('document listener failed');
        const notifications: string[] = [];
        editor.events.on('document:change', () => {
            notifications.push('document');
            throw failure;
        });
        editor.events.on('mode:change', () => notifications.push('mode'));
        editor.events.on('state:change', () => notifications.push('state'));

        expect(() =>
            editor.update((transaction) => {
                transaction.replaceDocument('after');
                transaction.setMode('source');
            }),
        ).toThrow(failure);

        expect(editor.getData()).toBe('after');
        expect(editor.state.mode).toBe('source');
        expect(notifications).toEqual(['document', 'mode', 'state']);
    });
});
