import {
    CommandAlreadyRegisteredError,
    CommandNotFoundError,
    Editor,
} from '../src/index';

describe('CommandRegistry', () => {
    it('registers, gets, executes, and unregisters commands', async () => {
        const editor = await Editor.create();
        const command = {
            id: 'math.add',
            execute: (_context: unknown, ...args: readonly unknown[]) =>
                Number(args[0]) + Number(args[1]),
        };

        editor.commands.register(command);

        expect(editor.commands.has(command.id)).toBe(true);
        expect(editor.commands.get(command.id)).toBe(command);
        expect(editor.execute(command.id, 2, 3)).toBe(5);
        expect(editor.commands.unregister(command.id)).toBe(true);
        expect(editor.commands.unregister(command.id)).toBe(false);
    });

    it('rejects duplicate and missing commands with searchable IDs', async () => {
        const editor = await Editor.create();
        editor.commands.register({ id: 'duplicate', execute: () => undefined });

        expect(() =>
            editor.commands.register({
                id: 'duplicate',
                execute: () => undefined,
            }),
        ).toThrow(CommandAlreadyRegisteredError);
        expect(() => editor.commands.get('missing')).toThrow(
            new CommandNotFoundError('missing'),
        );
        expect(() => editor.commands.canExecute('missing')).toThrow(
            CommandNotFoundError,
        );
        expect(() => editor.commands.isActive('missing')).toThrow(
            CommandNotFoundError,
        );
    });

    it('queries defaults and explicit command state', async () => {
        const editor = await Editor.create();
        editor.commands.register({ id: 'default', execute: () => undefined });
        editor.commands.register({
            id: 'disabled',
            execute: () => {
                throw new Error('must not execute');
            },
            canExecute: () => false,
            isActive: () => true,
        });

        expect(editor.commands.canExecute('default')).toBe(true);
        expect(editor.commands.isActive('default')).toBe(false);
        expect(editor.commands.canExecute('disabled')).toBe(false);
        expect(editor.commands.isActive('disabled')).toBe(true);
        expect(editor.execute('disabled')).toBeUndefined();
    });

    it('emits before and after events with arguments', async () => {
        const editor = await Editor.create();
        const events: string[] = [];
        editor.commands.register({
            id: 'greet',
            execute: ({ editor: contextEditor }, name) => {
                expect(contextEditor).toBe(editor);
                return `Hello ${String(name)}`;
            },
        });
        editor.events.on('command:beforeExecute', ({ commandId, args }) => {
            events.push(`before:${commandId}:${String(args[0])}`);
        });
        editor.events.on('command:afterExecute', ({ commandId }) => {
            events.push(`after:${commandId}`);
        });

        expect(editor.execute('greet', 'Ada')).toBe('Hello Ada');
        expect(events).toEqual(['before:greet:Ada', 'after:greet']);
    });

    it('emits synchronous errors and rethrows the original value', async () => {
        const editor = await Editor.create();
        const failure = new Error('failure');
        let observed: unknown;
        editor.commands.register({
            id: 'fail',
            execute: () => {
                throw failure;
            },
        });
        editor.events.on('command:error', (event) => {
            observed = event.error;
            expect(event.commandId).toBe('fail');
            expect(event.args).toEqual([1]);
        });

        expect(() => editor.execute('fail', 1)).toThrow(failure);
        expect(observed).toBe(failure);
    });

    it('preserves the command error when an error listener throws', async () => {
        const editor = await Editor.create();
        const commandFailure = new Error('command failure');
        const listenerFailure = new Error('listener failure');
        const eventErrors: unknown[] = [];
        editor.commands.register({
            id: 'fail.safely',
            execute: () => {
                throw commandFailure;
            },
        });
        editor.events.on('command:error', () => {
            throw listenerFailure;
        });
        editor.events.on('event:error', ({ eventName, error }) => {
            expect(eventName).toBe('command:error');
            eventErrors.push(error);
        });

        expect(() => editor.execute('fail.safely')).toThrow(commandFailure);
        expect(eventErrors).toEqual([listenerFailure]);
    });

    it('emits completion for resolved async commands', async () => {
        const editor = await Editor.create();
        const events: string[] = [];
        editor.commands.register({
            id: 'async.success',
            execute: async () => 'done',
        });
        editor.events.on('command:afterExecute', ({ commandId }) =>
            events.push(commandId),
        );

        await expect(editor.execute('async.success')).resolves.toBe('done');
        expect(events).toEqual(['async.success']);
    });

    it('emits rejected async errors and preserves rejection identity', async () => {
        const editor = await Editor.create();
        const failure = new Error('async failure');
        const errors: unknown[] = [];
        editor.commands.register({
            id: 'async.fail',
            execute: async () => {
                throw failure;
            },
        });
        editor.events.on('command:error', ({ error }) => errors.push(error));

        await expect(editor.execute('async.fail')).rejects.toBe(failure);
        expect(errors).toEqual([failure]);
    });

    it('awaits custom PromiseLike results before afterExecute', async () => {
        const editor = await Editor.create();
        const order: string[] = [];
        const thenable: PromiseLike<string> = {
            then: (onfulfilled, onrejected) =>
                Promise.resolve('done').then(onfulfilled, onrejected),
        };
        editor.commands.register({
            id: 'promise-like',
            execute: () => {
                order.push('execute');
                return thenable;
            },
        });
        editor.events.on('command:beforeExecute', () => order.push('before'));
        editor.events.on('command:afterExecute', () => order.push('after'));

        const result = editor.execute('promise-like');
        order.push('returned');
        await expect(result).resolves.toBe('done');

        expect(order).toEqual(['before', 'execute', 'returned', 'after']);
    });

    it('reads a stateful then accessor exactly once', async () => {
        const editor = await Editor.create();
        let reads = 0;
        const value = {
            get then():
                ((resolve: (result: string) => void) => void) | undefined {
                reads += 1;
                return reads === 1
                    ? (resolve: (result: string) => void) => resolve('done')
                    : undefined;
            },
        };
        editor.commands.register({
            id: 'stateful-then',
            execute: () => value,
        });

        await expect(editor.execute('stateful-then')).resolves.toBe('done');
        expect(reads).toBe(1);
    });

    it('reports and propagates a throwing then accessor as a command error', async () => {
        const editor = await Editor.create();
        const failure = new Error('then getter failed');
        const order: string[] = [];
        const value = {
            get then(): never {
                order.push('then');
                throw failure;
            },
        };
        editor.commands.register({
            id: 'throwing-then',
            execute: () => {
                order.push('execute');
                return value;
            },
        });
        editor.events.on('command:beforeExecute', () => order.push('before'));
        editor.events.on('command:error', ({ error }) => {
            expect(error).toBe(failure);
            order.push('error');
        });

        expect(() => editor.execute('throwing-then')).toThrow(failure);
        expect(order).toEqual(['before', 'execute', 'then', 'error']);
    });
});
