import type { Command } from './command.js';

/** Public command capabilities owned by one editor. */
export interface CommandCollection {
    /** Registers a command and rejects duplicate IDs. */
    register(command: Command): void;
    /** Removes a command and reports whether it existed. */
    unregister(id: string): boolean;
    /** Returns whether a command is registered. */
    has(id: string): boolean;
    /** Gets a command or throws when it is absent. */
    get(id: string): Command;
    /** Returns an immutable insertion-ordered snapshot of command IDs. */
    ids(): readonly string[];
    /** Reports whether a registered command can execute. */
    canExecute(id: string): boolean;
    /** Reports whether a registered command is active. */
    isActive(id: string): boolean;
    /** Executes a registered command with opaque arguments. */
    execute(id: string, ...args: readonly unknown[]): unknown;
}
