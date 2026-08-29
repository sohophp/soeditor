import type { Editor } from '../editor/editor.js';
import type { EditorDocument } from '../state/document.js';
import type { EditorMode, EditorState } from '../state/editor-state.js';
import type { Transaction } from '../transaction/transaction.js';

/** Payload emitted around a document source change. */
export interface DocumentChangeEvent {
    readonly previous: EditorDocument;
    readonly current: EditorDocument;
    readonly transaction: Transaction;
}

/** Payload emitted for any editor state transition. */
export interface StateChangeEvent {
    readonly previous: EditorState;
    readonly current: EditorState;
    readonly transaction?: Transaction;
}

/** Payload emitted when the active editor mode changes. */
export interface ModeChangeEvent {
    readonly previous: EditorMode;
    readonly current: EditorMode;
    readonly transaction: Transaction;
}

/** Payload emitted before and after command execution. */
export interface CommandExecutionEvent {
    readonly commandId: string;
    readonly args: readonly unknown[];
}

/** Payload emitted when command execution throws or rejects. */
export interface CommandErrorEvent extends CommandExecutionEvent {
    readonly error: unknown;
}

/** A plugin lifecycle phase that can report an error. */
export type PluginErrorPhase = 'construct' | 'init' | 'ready' | 'destroy';

/** Payload emitted when a plugin lifecycle hook fails. */
export interface PluginErrorEvent {
    readonly pluginId: string;
    readonly phase: PluginErrorPhase;
    readonly error: unknown;
}

/** Payload used to report a listener failure from a safely emitted event. */
export interface EventListenerErrorEvent {
    readonly eventName: string;
    readonly error: unknown;
}

/** Strongly typed events emitted by an editor instance. */
export interface CoreEventMap {
    readonly 'editor:ready': { readonly editor: Editor };
    readonly 'editor:destroy': { readonly editor: Editor };
    readonly 'document:beforeChange': DocumentChangeEvent;
    readonly 'document:change': DocumentChangeEvent;
    readonly 'state:change': StateChangeEvent;
    readonly 'mode:change': ModeChangeEvent;
    readonly 'command:beforeExecute': CommandExecutionEvent;
    readonly 'command:afterExecute': CommandExecutionEvent;
    readonly 'command:error': CommandErrorEvent;
    readonly 'plugin:error': PluginErrorEvent;
    readonly 'event:error': EventListenerErrorEvent;
}
