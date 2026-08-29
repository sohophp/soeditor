import {
    Editor,
    EditorDestroyedError,
    EditorInitializationAbortedError,
    Plugin,
    type PluginContext,
} from '../src/index';

describe('Editor startup lifecycle', () => {
    it('aborts without waiting for a never-settling init hook', async () => {
        const events: string[] = [];
        let destroyPromise: Promise<void> | undefined;

        class NeverSettlingInit extends Plugin {
            static readonly id = 'never-settling-init';

            override init(): Promise<void> {
                this.editor.events.on('editor:ready', () =>
                    events.push('editor:ready'),
                );
                destroyPromise = this.editor.destroy();
                return new Promise(() => undefined);
            }
        }

        const creation = Editor.create({ plugins: [NeverSettlingInit] });

        await expect(settleBeforeNextTurn(creation)).rejects.toBeInstanceOf(
            EditorInitializationAbortedError,
        );
        await expect(destroyPromise).resolves.toBeUndefined();
        expect(events).toEqual([]);
    });

    it('aborts without waiting for a never-settling ready hook', async () => {
        const events: string[] = [];
        let destroyPromise: Promise<void> | undefined;

        class NeverSettlingReady extends Plugin {
            static readonly id = 'never-settling-ready';

            override init(): void {
                events.push('init');
                this.editor.events.on('editor:ready', () =>
                    events.push('editor:ready'),
                );
            }

            override ready(): Promise<void> {
                events.push('ready');
                destroyPromise = this.editor.destroy();
                return new Promise(() => undefined);
            }

            override destroy(): void {
                events.push('destroy');
            }
        }

        const creation = Editor.create({ plugins: [NeverSettlingReady] });

        await expect(settleBeforeNextTurn(creation)).rejects.toBeInstanceOf(
            EditorInitializationAbortedError,
        );
        await expect(destroyPromise).resolves.toBeUndefined();
        expect(events).toEqual(['init', 'ready', 'destroy']);
    });

    it('ignores a hook that resolves after destruction wins startup', async () => {
        const events: string[] = [];
        let resolveHook: (() => void) | undefined;
        let capturedEditor: Editor | undefined;

        class LateResolve extends Plugin {
            static readonly id = 'late-resolve';

            override init(): Promise<void> {
                capturedEditor = this.editor;
                this.editor.events.on('editor:ready', () =>
                    events.push('editor:ready'),
                );
                void this.editor.destroy();
                return new Promise<void>((resolve) => {
                    resolveHook = resolve;
                });
            }

            override ready(): void {
                events.push('ready');
            }
        }

        const creation = Editor.create({ plugins: [LateResolve] });

        await expect(settleBeforeNextTurn(creation)).rejects.toBeInstanceOf(
            EditorInitializationAbortedError,
        );
        resolveHook?.();
        await nextTurn();

        expect(events).toEqual([]);
        expectEditorUnavailable(capturedEditor);
    });

    it('observes a hook that rejects after destruction wins startup', async () => {
        const lateFailure = new Error('late init failure');
        const unhandled: unknown[] = [];
        let rejectHook: ((reason: unknown) => void) | undefined;
        const onUnhandled = (reason: unknown): void => {
            unhandled.push(reason);
        };
        process.on('unhandledRejection', onUnhandled);

        try {
            class LateReject extends Plugin {
                static readonly id = 'late-reject';

                override init(): Promise<void> {
                    void this.editor.destroy();
                    return new Promise<void>((_resolve, reject) => {
                        rejectHook = reject;
                    });
                }
            }

            const creation = Editor.create({ plugins: [LateReject] });

            await expect(settleBeforeNextTurn(creation)).rejects.toBeInstanceOf(
                EditorInitializationAbortedError,
            );
            rejectHook?.(lateFailure);
            await nextTurn();

            expect(unhandled).toEqual([]);
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }
    });

    it('preserves ordinary asynchronous hook rejection identity', async () => {
        const failure = new Error('ordinary async init failure');

        class AsyncFailure extends Plugin {
            static readonly id = 'async-failure';

            override async init(): Promise<void> {
                await Promise.resolve();
                throw failure;
            }
        }

        await expect(Editor.create({ plugins: [AsyncFailure] })).rejects.toBe(
            failure,
        );
    });

    it('aborts terminally when a plugin constructor destroys the editor', async () => {
        const order: string[] = [];
        const registrationErrors: unknown[] = [];
        let capturedEditor: Editor | undefined;
        let firstDestroy: Promise<void> | undefined;
        let secondDestroy: Promise<void> | undefined;

        class Observer extends Plugin {
            static readonly id = 'observer';

            constructor(context: PluginContext) {
                super(context);
                order.push('observer:construct');
                context.editor.events.on('editor:ready', () =>
                    order.push('editor:ready'),
                );
                context.editor.events.on('editor:destroy', () =>
                    order.push('editor:destroy'),
                );
            }

            override init(): void {
                order.push('observer:init');
            }
        }

        class DestroyingConstructor extends Plugin {
            static readonly id = 'destroying-constructor';

            constructor(context: PluginContext) {
                super(context);
                order.push('destroying:construct');
                capturedEditor = context.editor;
                firstDestroy = context.editor.destroy();
                secondDestroy = context.editor.destroy();

                try {
                    context.editor.commands.register({
                        id: 'resurrect.command',
                        execute: () => undefined,
                    });
                } catch (error: unknown) {
                    registrationErrors.push(error);
                }

                try {
                    context.editor.services.register('resurrect.service', {});
                } catch (error: unknown) {
                    registrationErrors.push(error);
                }
            }

            override init(): void {
                order.push('destroying:init');
            }
        }

        class NeverConstructed extends Plugin {
            static readonly id = 'never-constructed';

            constructor(context: PluginContext) {
                super(context);
                order.push('never:construct');
            }
        }

        await expect(
            Editor.create({
                plugins: [Observer, DestroyingConstructor, NeverConstructed],
            }),
        ).rejects.toBeInstanceOf(EditorInitializationAbortedError);

        expect(firstDestroy).toBe(secondDestroy);
        await expect(firstDestroy).resolves.toBeUndefined();
        expect(capturedEditor?.destroy()).toBe(firstDestroy);
        expect(registrationErrors).toHaveLength(2);
        expect(registrationErrors).toEqual([
            expect.any(EditorDestroyedError),
            expect.any(EditorDestroyedError),
        ]);
        expect(order).toEqual([
            'observer:construct',
            'destroying:construct',
            'editor:destroy',
        ]);
        expectEditorUnavailable(capturedEditor);
    });

    it('stops synchronous init hooks and destroys only previously initialized plugins', async () => {
        const order: string[] = [];
        let capturedEditor: Editor | undefined;
        let destroyPromise: Promise<void> | undefined;
        let firstDestroyCalls = 0;

        class Initialized extends Plugin {
            static readonly id = 'initialized';

            override init(): void {
                order.push('initialized:init');
                this.editor.commands.register({
                    id: 'temporary.command',
                    execute: () => undefined,
                });
                this.editor.services.register('temporary.service', {});
                this.editor.events.on('editor:ready', () =>
                    order.push('editor:ready'),
                );
                this.editor.events.on('editor:destroy', () =>
                    order.push('editor:destroy'),
                );
            }

            override ready(): void {
                order.push('initialized:ready');
            }

            override destroy(): void {
                firstDestroyCalls += 1;
                order.push('initialized:destroy');
            }
        }

        class DestroyingInit extends Plugin {
            static readonly id = 'destroying-init';

            override init(): void {
                order.push('destroying:init');
                capturedEditor = this.editor;
                destroyPromise = this.editor.destroy();
                order.push('destroying:init-return');
            }

            override ready(): void {
                order.push('destroying:ready');
            }

            override destroy(): void {
                order.push('destroying:destroy');
            }
        }

        class NeverInitialized extends Plugin {
            static readonly id = 'never-initialized';

            override init(): void {
                order.push('never:init');
            }

            override destroy(): void {
                order.push('never:destroy');
            }
        }

        await expect(
            Editor.create({
                plugins: [Initialized, DestroyingInit, NeverInitialized],
            }),
        ).rejects.toBeInstanceOf(EditorInitializationAbortedError);

        expect(firstDestroyCalls).toBe(1);
        expect(capturedEditor?.destroy()).toBe(destroyPromise);
        expect(order).toEqual([
            'initialized:init',
            'destroying:init',
            'initialized:destroy',
            'destroying:init-return',
            'editor:destroy',
        ]);
        expectEditorUnavailable(capturedEditor);
    });

    it('does not promote a plugin whose asynchronous init completes after destruction', async () => {
        const order: string[] = [];
        let capturedEditor: Editor | undefined;
        let destroyPromise: Promise<void> | undefined;

        class Initialized extends Plugin {
            static readonly id = 'initialized';

            override init(): void {
                order.push('initialized:init');
            }

            override destroy(): void {
                order.push('initialized:destroy');
            }
        }

        class AsyncDestroyingInit extends Plugin {
            static readonly id = 'async-destroying-init';

            override async init(): Promise<void> {
                order.push('async:init-start');
                await Promise.resolve();
                order.push('async:init-resume');
                capturedEditor = this.editor;
                destroyPromise = this.editor.destroy();
                await destroyPromise;
                order.push('async:init-return');
            }

            override ready(): void {
                order.push('async:ready');
            }

            override destroy(): void {
                order.push('async:destroy');
            }
        }

        class NeverInitialized extends Plugin {
            static readonly id = 'never-initialized-async';

            override init(): void {
                order.push('never:init');
            }
        }

        await expect(
            Editor.create({
                plugins: [Initialized, AsyncDestroyingInit, NeverInitialized],
            }),
        ).rejects.toBeInstanceOf(EditorInitializationAbortedError);

        expect(capturedEditor?.destroy()).toBe(destroyPromise);
        expect(order).toEqual([
            'initialized:init',
            'async:init-start',
            'async:init-resume',
            'initialized:destroy',
            'async:init-return',
        ]);
        expectEditorUnavailable(capturedEditor);
    });

    it('stops ready hooks and destroys every initialized plugin exactly once', async () => {
        const order: string[] = [];
        const destroyCounts = new Map<string, number>();
        let capturedEditor: Editor | undefined;
        let destroyPromise: Promise<void> | undefined;

        const recordDestroy = (id: string): void => {
            destroyCounts.set(id, (destroyCounts.get(id) ?? 0) + 1);
            order.push(`${id}:destroy`);
        };

        class ReadyBefore extends Plugin {
            static readonly id = 'ready-before';

            override init(): void {
                order.push('before:init');
                this.editor.events.on('editor:ready', () =>
                    order.push('editor:ready'),
                );
                this.editor.events.on('editor:destroy', () =>
                    order.push('editor:destroy'),
                );
            }

            override ready(): void {
                order.push('before:ready');
            }

            override destroy(): void {
                recordDestroy('before');
            }
        }

        class DestroyingReady extends Plugin {
            static readonly id = 'destroying-ready';

            override init(): void {
                order.push('destroying:init');
            }

            override ready(): void {
                order.push('destroying:ready');
                capturedEditor = this.editor;
                destroyPromise = this.editor.destroy();
            }

            override destroy(): void {
                recordDestroy('destroying');
            }
        }

        class ReadyAfter extends Plugin {
            static readonly id = 'ready-after';

            override init(): void {
                order.push('after:init');
            }

            override ready(): void {
                order.push('after:ready');
            }

            override destroy(): void {
                recordDestroy('after');
            }
        }

        await expect(
            Editor.create({
                plugins: [ReadyBefore, DestroyingReady, ReadyAfter],
            }),
        ).rejects.toBeInstanceOf(EditorInitializationAbortedError);

        expect(capturedEditor?.destroy()).toBe(destroyPromise);
        expect(destroyCounts).toEqual(
            new Map([
                ['after', 1],
                ['destroying', 1],
                ['before', 1],
            ]),
        );
        expect(order).toEqual([
            'before:init',
            'destroying:init',
            'after:init',
            'before:ready',
            'destroying:ready',
            'after:destroy',
            'destroying:destroy',
            'before:destroy',
            'editor:destroy',
        ]);
        expectEditorUnavailable(capturedEditor);
    });

    it('rejects instead of returning an editor destroyed by a ready listener', async () => {
        const order: string[] = [];
        let capturedEditor: Editor | undefined;
        let destroyPromise: Promise<void> | undefined;

        class ReadyListener extends Plugin {
            static readonly id = 'ready-listener';

            override init(): void {
                capturedEditor = this.editor;
                this.editor.events.on('editor:ready', () => {
                    order.push('editor:ready');
                    destroyPromise = this.editor.destroy();
                });
                this.editor.events.on('editor:destroy', () =>
                    order.push('editor:destroy'),
                );
            }

            override destroy(): void {
                order.push('plugin:destroy');
            }
        }

        await expect(
            Editor.create({ plugins: [ReadyListener] }),
        ).rejects.toBeInstanceOf(EditorInitializationAbortedError);

        expect(capturedEditor?.destroy()).toBe(destroyPromise);
        expect(order).toEqual([
            'editor:ready',
            'plugin:destroy',
            'editor:destroy',
        ]);
        expectEditorUnavailable(capturedEditor);
    });
});

function expectEditorUnavailable(editor: Editor | undefined): void {
    expect(editor).toBeDefined();

    if (editor === undefined) {
        return;
    }

    expect(() => editor.commands.has('temporary.command')).toThrow(
        EditorDestroyedError,
    );
    expect(() => editor.services.has('temporary.service')).toThrow(
        EditorDestroyedError,
    );
    expect(() => editor.createTransaction()).toThrow(EditorDestroyedError);
}

function settleBeforeNextTurn<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const immediate = setImmediate(() => {
            reject(new Error('Promise did not settle before the next turn.'));
        });

        void promise.then(
            (value) => {
                clearImmediate(immediate);
                resolve(value);
            },
            (error: unknown) => {
                clearImmediate(immediate);
                reject(error);
            },
        );
    });
}

function nextTurn(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}
