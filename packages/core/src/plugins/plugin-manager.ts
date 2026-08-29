import type { Editor } from '../editor/editor.js';
import {
    PluginDependencyCycleError,
    PluginDuplicateIdError,
    PluginNotFoundError,
} from '../errors/errors.js';
import type { CoreEventMap, PluginErrorPhase } from '../events/core-events.js';
import { emitSafely, type EventBus } from '../events/event-bus.js';
import type { PluginCollection } from './plugin-collection.js';
import type { Plugin, PluginConstructor } from './plugin.js';

type PluginStage = 'constructed' | 'initialized' | 'ready' | 'destroyed';

interface PluginEntry {
    readonly constructor: PluginConstructor;
    readonly instance: Plugin;
    stage: PluginStage;
}

interface PluginManagerRecord {
    readonly assertAvailable: () => void;
    readonly editor: Editor;
    readonly events: EventBus<CoreEventMap>;
    readonly instances: Map<string, PluginEntry>;
    order: readonly PluginConstructor[];
}

interface PluginStartupControl {
    readonly assertInitializing: () => void;
    readonly destructionStarted: Promise<void>;
    readonly getDestroyPromise: () => Promise<void> | undefined;
}

type StartupHookOutcome =
    | { readonly status: 'fulfilled' }
    | { readonly status: 'rejected'; readonly error: unknown }
    | { readonly status: 'destroying' };

const records = new WeakMap<PluginManager, PluginManagerRecord>();

/** @internal Resolves and stores plugins owned by one editor. */
export class PluginManager implements PluginCollection {
    constructor(
        editor: Editor,
        events: EventBus<CoreEventMap>,
        assertAvailable: () => void,
    ) {
        records.set(this, {
            assertAvailable,
            editor,
            events,
            instances: new Map(),
            order: [],
        });
    }

    has(key: string | PluginConstructor): boolean {
        const record = getRecord(this);
        record.assertAvailable();
        return record.instances.has(typeof key === 'string' ? key : key.id);
    }

    get(id: string): Plugin;
    get<Instance extends Plugin>(
        constructor: PluginConstructor<Instance>,
    ): Instance;
    get<Instance extends Plugin>(
        key: string | PluginConstructor<Instance>,
    ): Plugin | Instance {
        const record = getRecord(this);
        record.assertAvailable();
        const id = typeof key === 'string' ? key : key.id;
        const entry = record.instances.get(id);

        if (entry === undefined) {
            throw new PluginNotFoundError(id);
        }

        return entry.instance;
    }

    tryGet(id: string): Plugin | undefined;
    tryGet<Instance extends Plugin>(
        constructor: PluginConstructor<Instance>,
    ): Instance | undefined;
    tryGet<Instance extends Plugin>(
        key: string | PluginConstructor<Instance>,
    ): Plugin | Instance | undefined {
        const record = getRecord(this);
        record.assertAvailable();
        const id = typeof key === 'string' ? key : key.id;
        return record.instances.get(id)?.instance;
    }
}

function getRecord(manager: PluginManager): PluginManagerRecord {
    const record = records.get(manager);

    if (record === undefined) {
        throw new Error('Plugin manager storage is unavailable.');
    }

    return record;
}

function emitPluginError(
    record: PluginManagerRecord,
    pluginId: string,
    phase: PluginErrorPhase,
    error: unknown,
): void {
    emitSafely(
        record.events,
        'plugin:error',
        Object.freeze({ pluginId, phase, error }),
    );
}

/** @internal Constructs, initializes, and readies resolved plugins. */
export async function initializePlugins(
    manager: PluginManager,
    constructors: readonly PluginConstructor[],
    startup: PluginStartupControl,
): Promise<void> {
    const record = getRecord(manager);
    const order = resolvePlugins(constructors);
    startup.assertInitializing();
    record.order = order;
    const context = Object.freeze({ editor: record.editor });

    for (const constructor of record.order) {
        startup.assertInitializing();
        let instance: Plugin;

        try {
            instance = new constructor(context);
        } catch (error: unknown) {
            startup.assertInitializing();
            emitPluginError(record, constructor.id, 'construct', error);
            throw error;
        }

        startup.assertInitializing();
        record.instances.set(constructor.id, {
            constructor,
            instance,
            stage: 'constructed',
        });
    }

    for (const constructor of record.order) {
        startup.assertInitializing();
        const entry = record.instances.get(constructor.id);

        if (entry === undefined) {
            throw new Error(`Plugin "${constructor.id}" was not constructed.`);
        }

        try {
            await waitForStartupHook(entry.instance.init?.(), startup);
        } catch (error: unknown) {
            startup.assertInitializing();
            emitPluginError(record, constructor.id, 'init', error);
            throw error;
        }

        startup.assertInitializing();
        entry.stage = 'initialized';
    }

    for (const constructor of record.order) {
        startup.assertInitializing();
        const entry = record.instances.get(constructor.id);

        if (entry === undefined) {
            throw new Error(`Plugin "${constructor.id}" was not constructed.`);
        }

        try {
            await waitForStartupHook(entry.instance.ready?.(), startup);
        } catch (error: unknown) {
            startup.assertInitializing();
            emitPluginError(record, constructor.id, 'ready', error);
            throw error;
        }

        startup.assertInitializing();
        entry.stage = 'ready';
    }

    startup.assertInitializing();
}

async function waitForStartupHook(
    result: void | Promise<void>,
    startup: PluginStartupControl,
): Promise<void> {
    const hookOutcome: Promise<StartupHookOutcome> = Promise.resolve(
        result,
    ).then(
        () => ({ status: 'fulfilled' }),
        (error: unknown) => ({ status: 'rejected', error }),
    );
    const activeDestroy = startup.getDestroyPromise();

    if (activeDestroy !== undefined) {
        await activeDestroy;
        startup.assertInitializing();
        return;
    }

    const outcome = await Promise.race([
        hookOutcome,
        startup.destructionStarted.then((): StartupHookOutcome => ({
            status: 'destroying',
        })),
    ]);

    if (outcome.status === 'rejected') {
        throw outcome.error;
    }

    if (outcome.status === 'destroying') {
        const destroyPromise = startup.getDestroyPromise();

        if (destroyPromise === undefined) {
            throw new Error(
                'Editor destruction started without a shared destroy promise.',
            );
        }

        await destroyPromise;
        startup.assertInitializing();
    }
}

/** @internal Destroys successfully initialized plugins in reverse order. */
export async function destroyPlugins(manager: PluginManager): Promise<void> {
    const record = getRecord(manager);

    for (const constructor of [...record.order].reverse()) {
        const entry = record.instances.get(constructor.id);

        if (
            entry === undefined ||
            entry.stage === 'constructed' ||
            entry.stage === 'destroyed'
        ) {
            continue;
        }

        entry.stage = 'destroyed';

        try {
            await entry.instance.destroy?.();
        } catch (error: unknown) {
            emitPluginError(record, constructor.id, 'destroy', error);
        }
    }

    record.instances.clear();
    record.order = [];
}

function resolvePlugins(
    roots: readonly PluginConstructor[],
): readonly PluginConstructor[] {
    const byId = new Map<string, PluginConstructor>();
    const visited = new Set<PluginConstructor>();
    const visiting: PluginConstructor[] = [];
    const ordered: PluginConstructor[] = [];

    const visit = (constructor: PluginConstructor): void => {
        const existing = byId.get(constructor.id);

        if (existing !== undefined && existing !== constructor) {
            throw new PluginDuplicateIdError(constructor.id);
        }

        byId.set(constructor.id, constructor);
        const cycleStart = visiting.indexOf(constructor);

        if (cycleStart !== -1) {
            const path = visiting.slice(cycleStart).map((item) => item.id);
            path.push(constructor.id);
            throw new PluginDependencyCycleError(path);
        }

        if (visited.has(constructor)) {
            return;
        }

        visiting.push(constructor);

        for (const requirement of constructor.requires ?? []) {
            visit(requirement);
        }

        visiting.pop();
        visited.add(constructor);
        ordered.push(constructor);
    };

    for (const constructor of roots) {
        visit(constructor);
    }

    return Object.freeze(ordered);
}
