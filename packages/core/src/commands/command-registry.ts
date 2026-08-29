import type { Editor } from '../editor/editor.js';
import {
    CommandAlreadyRegisteredError,
    CommandNotFoundError,
} from '../errors/errors.js';
import type { CoreEventMap } from '../events/core-events.js';
import {
    emitInternally,
    emitSafely,
    type EventBus,
} from '../events/event-bus.js';
import type { CommandCollection } from './command-collection.js';
import type { Command } from './command.js';

interface CommandRegistryRecord {
    readonly assertAvailable: () => void;
    readonly commands: Map<string, Command>;
    readonly context: { readonly editor: Editor };
    readonly events: EventBus<CoreEventMap>;
}

const records = new WeakMap<CommandRegistry, CommandRegistryRecord>();

/** @internal Per-editor command storage. */
export class CommandRegistry implements CommandCollection {
    constructor(
        editor: Editor,
        events: EventBus<CoreEventMap>,
        assertAvailable: () => void,
    ) {
        records.set(this, {
            assertAvailable,
            commands: new Map(),
            context: Object.freeze({ editor }),
            events,
        });
    }

    register(command: Command): void {
        const record = getRecord(this);
        record.assertAvailable();

        if (record.commands.has(command.id)) {
            throw new CommandAlreadyRegisteredError(command.id);
        }

        record.commands.set(command.id, command);
    }

    unregister(id: string): boolean {
        const record = getRecord(this);
        record.assertAvailable();
        return record.commands.delete(id);
    }

    has(id: string): boolean {
        const record = getRecord(this);
        record.assertAvailable();
        return record.commands.has(id);
    }

    get(id: string): Command {
        const record = getRecord(this);
        record.assertAvailable();
        const command = record.commands.get(id);

        if (command === undefined) {
            throw new CommandNotFoundError(id);
        }

        return command;
    }

    canExecute(id: string): boolean {
        const record = getRecord(this);
        const command = this.get(id);
        return command.canExecute?.(record.context) ?? true;
    }

    isActive(id: string): boolean {
        const record = getRecord(this);
        const command = this.get(id);
        return command.isActive?.(record.context) ?? false;
    }

    execute(id: string, ...args: readonly unknown[]): unknown {
        const record = getRecord(this);
        const command = this.get(id);

        if (!(command.canExecute?.(record.context) ?? true)) {
            return undefined;
        }

        const event = Object.freeze({
            commandId: id,
            args: Object.freeze(args),
        });
        emitInternally(record.events, 'command:beforeExecute', event);

        let result: unknown;
        let then: ThenMethod | undefined;

        try {
            result = command.execute(record.context, ...args);
            then = getThenMethod(result);
        } catch (error: unknown) {
            emitSafely(
                record.events,
                'command:error',
                Object.freeze({ ...event, error }),
            );
            throw error;
        }

        if (then !== undefined) {
            return assimilateThenable(result, then).then(
                (value) => {
                    emitInternally(
                        record.events,
                        'command:afterExecute',
                        event,
                    );
                    return value;
                },
                (error: unknown) => {
                    emitSafely(
                        record.events,
                        'command:error',
                        Object.freeze({ ...event, error }),
                    );
                    throw error;
                },
            );
        }

        emitInternally(record.events, 'command:afterExecute', event);
        return result;
    }
}

function getRecord(registry: CommandRegistry): CommandRegistryRecord {
    const record = records.get(registry);

    if (record === undefined) {
        throw new Error('Command registry storage is unavailable.');
    }

    return record;
}

type ThenMethod = (
    onFulfilled: (value: unknown) => void,
    onRejected: (reason: unknown) => void,
) => unknown;

function getThenMethod(value: unknown): ThenMethod | undefined {
    if (
        (typeof value !== 'object' || value === null) &&
        typeof value !== 'function'
    ) {
        return undefined;
    }

    const then: unknown = Reflect.get(value, 'then');
    return typeof then === 'function' ? (then as ThenMethod) : undefined;
}

function assimilateThenable(
    value: unknown,
    then: ThenMethod,
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        try {
            then.call(value, resolve, reject);
        } catch (error: unknown) {
            reject(error);
        }
    });
}

/** @internal Clears commands without exposing cleanup to consumers. */
export function clearCommands(registry: CommandRegistry): void {
    getRecord(registry).commands.clear();
}
