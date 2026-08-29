import type { Editor } from '../editor/editor.js';

/** Context supplied whenever a command is queried or executed. */
export interface CommandContext {
    /** The editor instance executing or querying the command. */
    readonly editor: Editor;
}

/** A user-triggerable editor behavior registered under a stable ID. */
export interface Command {
    /** Stable command identifier, conventionally in namespace.action form. */
    readonly id: string;
    /** Human-readable label for a no-argument command offered to palettes. */
    readonly label?: string;
    /** Executes the command with opaque caller arguments. */
    execute(
        context: CommandContext,
        ...args: readonly unknown[]
    ): unknown | PromiseLike<unknown>;
    /** Reports whether the command is currently available. */
    canExecute?(context: CommandContext): boolean;
    /** Reports whether the command currently represents active state. */
    isActive?(context: CommandContext): boolean;
}
