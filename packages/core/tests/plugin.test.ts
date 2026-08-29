import {
    Editor,
    EditorDestroyedError,
    Plugin,
    PluginDependencyCycleError,
    PluginDuplicateIdError,
    PluginNotFoundError,
    type PluginConstructor,
    type PluginContext,
} from '../src/index';

describe('PluginManager', () => {
    it('loads dependencies automatically and exposes instances', async () => {
        class Dependency extends Plugin {
            static readonly id = 'dependency';

            value(): string {
                return 'loaded';
            }
        }

        class Feature extends Plugin {
            static readonly id = 'feature';
            static readonly requires = [Dependency];
        }

        const editor = await Editor.create({ plugins: [Feature] });

        expect(editor.plugins.has('dependency')).toBe(true);
        expect(editor.plugins.has(Feature)).toBe(true);
        expect(editor.plugins.get(Dependency).value()).toBe('loaded');
        expect(editor.plugins.get('feature')).toBeInstanceOf(Feature);
        expect(editor.plugins.tryGet(Feature)).toBeInstanceOf(Feature);
        expect(editor.plugins.tryGet('missing')).toBeUndefined();
    });

    it('deduplicates the same constructor required through multiple paths', async () => {
        let constructions = 0;

        class Shared extends Plugin {
            static readonly id = 'shared';

            constructor(context: PluginContext) {
                super(context);
                constructions += 1;
            }
        }

        class First extends Plugin {
            static readonly id = 'first';
            static readonly requires = [Shared];
        }

        class Second extends Plugin {
            static readonly id = 'second';
            static readonly requires = [Shared];
        }

        await Editor.create({ plugins: [First, Second, Shared] });

        expect(constructions).toBe(1);
    });

    it('runs all init hooks before ready hooks in dependency order', async () => {
        const order: string[] = [];

        class Dependency extends Plugin {
            static readonly id = 'dependency';
            override async init(): Promise<void> {
                await Promise.resolve();
                order.push('dependency:init');
            }
            override ready(): void {
                order.push('dependency:ready');
            }
        }

        class Feature extends Plugin {
            static readonly id = 'feature';
            static readonly requires = [Dependency];
            override init(): void {
                order.push('feature:init');
            }
            override async ready(): Promise<void> {
                await Promise.resolve();
                order.push('feature:ready');
            }
        }

        await Editor.create({ plugins: [Feature] });

        expect(order).toEqual([
            'dependency:init',
            'feature:init',
            'dependency:ready',
            'feature:ready',
        ]);
    });

    it('rejects different plugin constructors with the same ID', async () => {
        class First extends Plugin {
            static readonly id = 'duplicate';
        }
        class Second extends Plugin {
            static readonly id = 'duplicate';
        }

        await expect(
            Editor.create({ plugins: [First, Second] }),
        ).rejects.toThrow(PluginDuplicateIdError);
    });

    it('detects dependency cycles and includes their path', async () => {
        class First extends Plugin {
            static readonly id = 'first';
            static requires: readonly PluginConstructor[] = [];
        }
        class Second extends Plugin {
            static readonly id = 'second';
            static requires: readonly PluginConstructor[] = [];
        }
        First.requires = [Second];
        Second.requires = [First];

        const creation = Editor.create({ plugins: [First] });

        await expect(creation).rejects.toThrow(PluginDependencyCycleError);
        await expect(creation).rejects.toThrow('first -> second -> first');
    });

    it('throws a clear error for missing plugins', async () => {
        class Missing extends Plugin {
            static readonly id = 'missing';
        }
        const editor = await Editor.create();

        expect(() => editor.plugins.get('missing')).toThrow(
            new PluginNotFoundError('missing'),
        );
        expect(() => editor.plugins.get(Missing)).toThrow(PluginNotFoundError);
    });

    it('destroys plugins in reverse dependency order', async () => {
        const order: string[] = [];

        class Dependency extends Plugin {
            static readonly id = 'dependency';
            override destroy(): void {
                order.push('dependency');
            }
        }

        class Feature extends Plugin {
            static readonly id = 'feature';
            static readonly requires = [Dependency];
            override async destroy(): Promise<void> {
                await Promise.resolve();
                order.push('feature');
            }
        }

        const editor = await Editor.create({ plugins: [Feature] });
        await editor.destroy();

        expect(order).toEqual(['feature', 'dependency']);
        expect(() => editor.plugins.has(Feature)).toThrow(EditorDestroyedError);
    });

    it('isolates destroy failures and emits plugin errors', async () => {
        const order: string[] = [];
        const errors: string[] = [];

        class Observer extends Plugin {
            static readonly id = 'observer';
            override init(): void {
                this.editor.events.on(
                    'plugin:error',
                    ({ pluginId, phase, error }) => {
                        const message =
                            error instanceof Error
                                ? error.message
                                : String(error);
                        errors.push(`${pluginId}:${phase}:${message}`);
                    },
                );
            }
            override destroy(): void {
                order.push('observer');
            }
        }

        class Broken extends Plugin {
            static readonly id = 'broken';
            override destroy(): void {
                order.push('broken');
                throw new Error('cleanup failed');
            }
        }

        const editor = await Editor.create({ plugins: [Observer, Broken] });
        await expect(editor.destroy()).resolves.toBeUndefined();

        expect(order).toEqual(['broken', 'observer']);
        expect(errors).toEqual(['broken:destroy:cleanup failed']);
    });

    it('emits an init error and rejects creation with the original error', async () => {
        const failure = new Error('init failed');
        const observed: unknown[] = [];

        class Observer extends Plugin {
            static readonly id = 'observer';
            override init(): void {
                this.editor.events.on('plugin:error', ({ error }) => {
                    observed.push(error);
                });
            }
        }

        class Broken extends Plugin {
            static readonly id = 'broken';
            override init(): void {
                throw failure;
            }
        }

        await expect(
            Editor.create({ plugins: [Observer, Broken] }),
        ).rejects.toBe(failure);
        expect(observed).toEqual([failure]);
    });

    it('does not destroy constructed plugins when a constructor fails', async () => {
        const order: string[] = [];

        class Constructed extends Plugin {
            static readonly id = 'constructed';
            constructor(context: PluginContext) {
                super(context);
                context.editor.events.on('plugin:error', ({ phase }) =>
                    order.push(`error:${phase}`),
                );
                order.push('constructed');
            }
            override destroy(): void {
                order.push('destroyed');
            }
        }

        class Broken extends Plugin {
            static readonly id = 'broken';
            constructor(context: PluginContext) {
                super(context);
                throw new Error('constructor failed');
            }
        }

        await expect(
            Editor.create({ plugins: [Constructed, Broken] }),
        ).rejects.toThrow('constructor failed');
        expect(order).toEqual(['constructed', 'error:construct']);
    });

    it('destroys only plugins whose init completed before an init failure', async () => {
        const order: string[] = [];

        class First extends Plugin {
            static readonly id = 'first';
            override init(): void {
                order.push('first:init');
            }
            override destroy(): void {
                order.push('first:destroy');
            }
        }

        class Broken extends Plugin {
            static readonly id = 'broken';
            override init(): void {
                order.push('broken:init');
                throw new Error('middle init failed');
            }
            override destroy(): void {
                order.push('broken:destroy');
            }
        }

        class Last extends Plugin {
            static readonly id = 'last';
            override init(): void {
                order.push('last:init');
            }
            override destroy(): void {
                order.push('last:destroy');
            }
        }

        await expect(
            Editor.create({ plugins: [First, Broken, Last] }),
        ).rejects.toThrow('middle init failed');
        expect(order).toEqual(['first:init', 'broken:init', 'first:destroy']);
    });

    it('does not destroy a plugin whose first init hook fails', async () => {
        const order: string[] = [];

        class Broken extends Plugin {
            static readonly id = 'broken';
            override init(): void {
                order.push('init');
                throw new Error('first init failed');
            }
            override destroy(): void {
                order.push('destroy');
            }
        }

        await expect(Editor.create({ plugins: [Broken] })).rejects.toThrow(
            'first init failed',
        );
        expect(order).toEqual(['init']);
    });

    it('continues destruction when a plugin:error listener throws', async () => {
        const order: string[] = [];
        const listenerFailure = new Error('plugin error listener failed');
        const reported: unknown[] = [];

        class Survivor extends Plugin {
            static readonly id = 'survivor';
            override init(): void {
                this.editor.events.on('plugin:error', () => {
                    throw listenerFailure;
                });
                this.editor.events.on('event:error', ({ eventName, error }) => {
                    expect(eventName).toBe('plugin:error');
                    reported.push(error);
                });
            }
            override destroy(): void {
                order.push('survivor');
            }
        }

        class Broken extends Plugin {
            static readonly id = 'broken';
            override destroy(): void {
                order.push('broken');
                throw new Error('destroy failed');
            }
        }

        const editor = await Editor.create({ plugins: [Survivor, Broken] });
        await expect(editor.destroy()).resolves.toBeUndefined();

        expect(order).toEqual(['broken', 'survivor']);
        expect(reported).toEqual([listenerFailure]);
    });

    it('emits a ready error only after initialization completes', async () => {
        const order: string[] = [];

        class Broken extends Plugin {
            static readonly id = 'broken';
            override init(): void {
                order.push('init');
                this.editor.events.on('plugin:error', ({ phase }) =>
                    order.push(`error:${phase}`),
                );
            }
            override ready(): void {
                order.push('ready');
                throw new Error('ready failed');
            }
            override destroy(): void {
                order.push('destroy');
            }
        }

        await expect(Editor.create({ plugins: [Broken] })).rejects.toThrow(
            'ready failed',
        );
        expect(order).toEqual(['init', 'ready', 'error:ready', 'destroy']);
    });
});
