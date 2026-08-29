import { clearEvents, emitSafely, EventBus } from '../src/events/event-bus.js';

interface TestEvents {
    'event:error': { eventName: string; error: unknown };
    value: number;
    empty: undefined;
}

describe('EventBus', () => {
    it('subscribes, emits, and disposes listeners', () => {
        const bus = new EventBus<TestEvents>();
        const values: number[] = [];
        const dispose = bus.on('value', (value) => values.push(value));

        bus.emit('value', 1);
        dispose();
        dispose();
        bus.emit('value', 2);

        expect(values).toEqual([1]);
    });

    it('runs a once listener at most once', () => {
        const bus = new EventBus<TestEvents>();
        const values: number[] = [];
        bus.once('value', (value) => values.push(value));

        bus.emit('value', 1);
        bus.emit('value', 2);

        expect(values).toEqual([1]);
    });

    it('allows a once listener to emit recursively', () => {
        const bus = new EventBus<TestEvents>();
        let calls = 0;
        bus.once('empty', () => {
            calls += 1;
            bus.emit('empty', undefined);
        });

        bus.emit('empty', undefined);

        expect(calls).toBe(1);
    });

    it('uses a stable listener snapshot and can clear listeners', () => {
        const bus = new EventBus<TestEvents>();
        const calls: string[] = [];
        const second = (value: number): void => {
            calls.push(`second:${value}`);
        };
        bus.on('value', (value) => {
            calls.push(`first:${value}`);
            bus.on('value', second);
        });

        bus.emit('value', 1);
        bus.emit('value', 2);
        clearEvents(bus);
        bus.emit('value', 3);

        expect(calls).toEqual(['first:1', 'first:2', 'second:2']);
    });

    it('visits every listener before reporting listener failures', () => {
        const bus = new EventBus<TestEvents>();
        const calls: string[] = [];
        const failure = new Error('listener failed');
        bus.on('value', () => {
            calls.push('first');
            throw failure;
        });
        bus.on('value', () => calls.push('second'));

        expect(() => bus.emit('value', 1)).toThrow(failure);
        expect(calls).toEqual(['first', 'second']);
    });

    it('reports safe listener failures without throwing', () => {
        const bus = new EventBus<TestEvents>();
        const failure = new Error('listener failed');
        const reported: unknown[] = [];
        bus.on('value', () => {
            throw failure;
        });
        bus.on('event:error', ({ eventName, error }) => {
            expect(eventName).toBe('value');
            reported.push(error);
        });

        expect(emitSafely(bus, 'value', 1)).toEqual([failure]);
        expect(reported).toEqual([failure]);
    });

    it('aggregates multiple normal listener failures', () => {
        const bus = new EventBus<TestEvents>();
        bus.on('value', () => {
            throw new Error('first');
        });
        bus.on('value', () => {
            throw new Error('second');
        });

        expect(() => bus.emit('value', 1)).toThrow(AggregateError);
    });
});
