/**
 * A synchronous listener for a typed event payload.
 *
 * Returned promises are unsupported, are not awaited, and may produce an
 * unhandled rejection. Event work that must be asynchronous should be started
 * and observed outside the core event pipeline.
 */
export type EventListener<Payload> = (payload: Payload) => void;

/** Subscription-only event capabilities exposed by an editor instance. */
export interface EditorEvents<Events extends object> {
    /** Registers a listener and returns an idempotent disposer. */
    on<Name extends keyof Events>(
        name: Name,
        listener: EventListener<Events[Name]>,
    ): () => void;

    /** Registers a listener that is removed before its first invocation. */
    once<Name extends keyof Events>(
        name: Name,
        listener: EventListener<Events[Name]>,
    ): () => void;
}

interface EventBusRecord<Events extends object> {
    readonly assertAvailable: () => void;
    readonly listeners: Map<keyof Events, Set<EventListener<never>>>;
}

const records = new WeakMap<object, unknown>();

/** @internal Concrete event storage owned by one editor. */
export class EventBus<Events extends object> implements EditorEvents<Events> {
    constructor(assertAvailable: () => void = () => undefined) {
        records.set(this, {
            assertAvailable,
            listeners: new Map(),
        });
    }

    on<Name extends keyof Events>(
        name: Name,
        listener: EventListener<Events[Name]>,
    ): () => void {
        const record = getRecord(this);
        record.assertAvailable();
        const listeners = record.listeners.get(name) ?? new Set();
        listeners.add(listener as EventListener<never>);
        record.listeners.set(name, listeners);

        return () => {
            listeners.delete(listener as EventListener<never>);

            if (listeners.size === 0) {
                record.listeners.delete(name);
            }
        };
    }

    once<Name extends keyof Events>(
        name: Name,
        listener: EventListener<Events[Name]>,
    ): () => void {
        let dispose = (): void => undefined;
        const wrapped = (payload: Events[Name]): void => {
            dispose();
            listener(payload);
        };
        dispose = this.on(name, wrapped);
        return dispose;
    }

    emit<Name extends keyof Events>(name: Name, payload: Events[Name]): void {
        const record = getRecord(this);
        record.assertAvailable();
        throwListenerErrors(notify(record, name, payload));
    }
}

/** @internal Creates a subscription-only facade over an owned event bus. */
export function createEditorEvents<Events extends object>(
    events: EventBus<Events>,
): EditorEvents<Events> {
    return Object.freeze({
        on: events.on.bind(events),
        once: events.once.bind(events),
    });
}

function getRecord<Events extends object>(
    events: EventBus<Events>,
): EventBusRecord<Events> {
    const record = records.get(events) as EventBusRecord<Events> | undefined;

    if (record === undefined) {
        throw new Error('Event bus storage is unavailable.');
    }

    return record;
}

function notify<Events extends object, Name extends keyof Events>(
    record: EventBusRecord<Events>,
    name: Name,
    payload: Events[Name],
): readonly unknown[] {
    const listeners = record.listeners.get(name);

    if (listeners === undefined) {
        return [];
    }

    const errors: unknown[] = [];

    for (const listener of [...listeners]) {
        try {
            (listener as EventListener<Events[Name]>)(payload);
        } catch (error: unknown) {
            errors.push(error);
        }
    }

    return errors;
}

function throwListenerErrors(errors: readonly unknown[]): void {
    if (errors.length === 1) {
        throw errors[0];
    }

    if (errors.length > 1) {
        throw new AggregateError(errors, 'Multiple event listeners failed.');
    }
}

/** @internal Emits without owner guards and reports failures through event:error. */
export function emitSafely<
    Events extends {
        readonly 'event:error': { eventName: string; error: unknown };
    },
    Name extends keyof Events,
>(
    events: EventBus<Events>,
    name: Name,
    payload: Events[Name],
): readonly unknown[] {
    const record = getRecord(events);
    const errors = notify(record, name, payload);

    if (name !== 'event:error') {
        for (const error of errors) {
            notify(record, 'event:error', {
                eventName: String(name),
                error,
            });
        }
    }

    return errors;
}

/** @internal Emits without owner guards while preserving normal error policy. */
export function emitInternally<
    Events extends object,
    Name extends keyof Events,
>(events: EventBus<Events>, name: Name, payload: Events[Name]): void {
    throwListenerErrors(notify(getRecord(events), name, payload));
}

/** @internal Clears all listeners without exposing cleanup publicly. */
export function clearEvents<Events extends object>(
    events: EventBus<Events>,
): void {
    getRecord(events).listeners.clear();
}
