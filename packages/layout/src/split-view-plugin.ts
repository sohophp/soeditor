import {
    createServiceToken,
    Plugin,
    type DocumentFormat,
} from '@soeditor/core';
import {
    ProjectionCoordinatorPlugin,
    projectionCoordinatorServiceToken,
    type ProjectionId,
} from '@soeditor/projections';

export type SplitViewPair =
    'visual-source' | 'source-preview' | 'markdown-preview';
export type SplitOrientation = 'horizontal' | 'vertical';

export interface SplitViewSnapshot {
    readonly collapsed?: ProjectionId;
    readonly effectiveOrientation: SplitOrientation;
    readonly open: boolean;
    readonly orientation: SplitOrientation;
    readonly pair?: SplitViewPair;
    readonly ratio: number;
    readonly responsive: boolean;
}

export interface SplitViewAdapter {
    focus(id: ProjectionId): void;
    supports(pair: SplitViewPair): boolean;
    update(snapshot: SplitViewSnapshot): void;
}

export interface SplitViewAttachment {
    destroy(): void;
    setResponsive(active: boolean): void;
}

export interface SplitViewService {
    readonly attached: boolean;
    readonly snapshot: SplitViewSnapshot;
    attach(adapter: SplitViewAdapter): SplitViewAttachment;
    subscribe(listener: (snapshot: SplitViewSnapshot) => void): () => void;
}

export const splitViewServiceToken = createServiceToken<SplitViewService>(
    'soeditor.split-view',
);

export class SplitViewDestroyedError extends Error {
    constructor() {
        super('The split-view service has been destroyed.');
        this.name = 'SplitViewDestroyedError';
    }
}

export class SplitViewAlreadyAttachedError extends Error {
    constructor() {
        super('A split-view layout is already attached to this editor.');
        this.name = 'SplitViewAlreadyAttachedError';
    }
}

export class SplitViewNotAttachedError extends Error {
    constructor() {
        super(
            'A split-view layout must be attached before using layout commands.',
        );
        this.name = 'SplitViewNotAttachedError';
    }
}

export class IncompatibleSplitViewPairError extends Error {
    constructor(pair: SplitViewPair, format: DocumentFormat) {
        super(
            `Split-view pair "${pair}" is incompatible with "${format}" documents.`,
        );
        this.name = 'IncompatibleSplitViewPairError';
    }
}

export class InvalidSplitViewTransitionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidSplitViewTransitionError';
    }
}

const pairs = Object.freeze({
    'markdown-preview': ['markdown', 'preview'],
    'source-preview': ['source', 'preview'],
    'visual-source': ['visual', 'source'],
} satisfies Record<SplitViewPair, readonly [ProjectionId, ProjectionId]>);

export class SplitViewPlugin extends Plugin {
    static readonly id = 'split-view';
    static readonly requires = [ProjectionCoordinatorPlugin];

    readonly #listeners = new Set<(snapshot: SplitViewSnapshot) => void>();
    #adapter: SplitViewAdapter | undefined;
    #collapsed: ProjectionId | undefined;
    #destroyed = false;
    #open = false;
    #orientation: SplitOrientation = 'horizontal';
    #pair: SplitViewPair | undefined;
    #ratio = 50;
    #responsive = false;

    override init(): void {
        const getAttached = (): boolean => this.#isAttached();
        const getSnapshot = (): SplitViewSnapshot => this.#snapshot();
        const service = Object.freeze<SplitViewService>({
            get attached() {
                return getAttached();
            },
            get snapshot() {
                return getSnapshot();
            },
            attach: (adapter) => this.#attach(adapter),
            subscribe: (listener) => this.#subscribe(listener),
        });
        this.editor.services.register(splitViewServiceToken, service);
        this.#register('layout.split.open', (args) =>
            this.#openPair(readPair('layout.split.open', args)),
        );
        this.#register(
            'layout.split.close',
            (args) => {
                assertNoArguments('layout.split.close', args);
                this.#close();
            },
            { canExecute: () => this.#open, label: 'Close split view' },
        );
        this.#register('layout.split.orientation', (args) =>
            this.#setOrientation(
                readOrientation('layout.split.orientation', args),
            ),
        );
        this.#register('layout.split.resize', (args) =>
            this.#setRatio(readRatio('layout.split.resize', args)),
        );
        this.#register('layout.split.collapse', (args) =>
            this.#collapse(readProjection('layout.split.collapse', args)),
        );
        this.#register(
            'layout.split.restore',
            (args) => {
                assertNoArguments('layout.split.restore', args);
                this.#restore();
            },
            {
                canExecute: () => this.#collapsed !== undefined,
                label: 'Restore split pane',
            },
        );
        this.#register('layout.split.focus', (args) =>
            this.#focus(readProjection('layout.split.focus', args)),
        );
    }

    override destroy(): void {
        this.#destroyed = true;
        this.#adapter = undefined;
        this.#listeners.clear();
    }

    #register(
        id: string,
        execute: (args: readonly unknown[]) => void,
        options: {
            readonly canExecute?: () => boolean;
            readonly label?: string;
        } = {},
    ): void {
        this.editor.commands.register({
            id,
            ...(options.label === undefined ? {} : { label: options.label }),
            canExecute: () =>
                this.#adapter !== undefined && (options.canExecute?.() ?? true),
            execute: (_context, ...args) => execute(args),
        });
    }

    #attach(adapter: SplitViewAdapter): SplitViewAttachment {
        this.#assertAlive();
        validateAdapter(adapter);
        if (this.#adapter !== undefined) {
            throw new SplitViewAlreadyAttachedError();
        }
        this.#adapter = adapter;
        try {
            adapter.update(this.#snapshot());
        } catch (error: unknown) {
            this.#adapter = undefined;
            throw error;
        }
        let active = true;
        return Object.freeze({
            destroy: () => {
                if (!active || this.#destroyed) return;
                if (this.#adapter === adapter) this.#adapter = undefined;
                active = false;
            },
            setResponsive: (responsive: boolean) => {
                if (!active || this.#adapter !== adapter) {
                    throw new SplitViewNotAttachedError();
                }
                if (typeof responsive !== 'boolean') {
                    throw new TypeError(
                        'Responsive split state must be boolean.',
                    );
                }
                if (this.#responsive !== responsive) {
                    this.#responsive = responsive;
                    this.#notify();
                }
            },
        });
    }

    #openPair(pair: SplitViewPair): void {
        this.#assertAttached();
        const format = this.editor.state.document.format;
        if (!isPairCompatible(pair, format)) {
            throw new IncompatibleSplitViewPairError(pair, format);
        }
        const coordinator = this.editor.services.get(
            projectionCoordinatorServiceToken,
        );
        if (this.#adapter?.supports(pair) !== true) {
            throw new InvalidSplitViewTransitionError(
                `The attached layout does not provide every host required by "${pair}".`,
            );
        }
        const members = pairs[pair];
        for (const id of members) {
            if (!coordinator.isAttached(id)) {
                throw new InvalidSplitViewTransitionError(
                    `Projection "${id}" must be attached before opening "${pair}".`,
                );
            }
        }
        for (const id of members) {
            if (!coordinator.get(id).visible) {
                this.editor.execute('projection.show', id);
            }
        }
        if (!pairIncludes(pair, coordinator.snapshot.primary)) {
            const writer = members.find((id) => id !== 'preview');
            if (writer !== undefined) {
                this.editor.execute('projection.activate', writer);
            }
        }
        for (const id of ['visual', 'source', 'markdown', 'preview'] as const) {
            if (
                !pairIncludes(pair, id) &&
                coordinator.isAttached(id) &&
                coordinator.get(id).visible &&
                id !== coordinator.snapshot.primary
            ) {
                this.editor.execute('projection.hide', id);
            }
        }
        this.#pair = pair;
        this.#open = true;
        this.#collapsed = undefined;
        this.#notify();
    }

    #close(): void {
        const pair = this.#requireOpenPair();
        const coordinator = this.editor.services.get(
            projectionCoordinatorServiceToken,
        );
        for (const id of pairs[pair]) {
            if (
                id !== coordinator.snapshot.primary &&
                coordinator.get(id).visible
            ) {
                this.editor.execute('projection.hide', id);
            }
        }
        this.#open = false;
        this.#collapsed = undefined;
        this.#notify();
    }

    #collapse(id: ProjectionId): void {
        const pair = this.#requireOpenPair();
        if (this.#collapsed !== undefined) {
            throw new InvalidSplitViewTransitionError(
                `Projection "${this.#collapsed}" must be restored before collapsing another pane.`,
            );
        }
        const members = pairs[pair];
        if (!pairIncludes(pair, id)) {
            throw new InvalidSplitViewTransitionError(
                `Projection "${id}" is not part of the open split view.`,
            );
        }
        const coordinator = this.editor.services.get(
            projectionCoordinatorServiceToken,
        );
        if (id === coordinator.snapshot.primary) {
            const replacement = members.find(
                (member) => member !== id && member !== 'preview',
            );
            if (replacement === undefined) {
                throw new InvalidSplitViewTransitionError(
                    `Primary projection "${id}" cannot be collapsed without another writer.`,
                );
            }
            this.editor.execute('projection.activate', replacement);
        }
        if (coordinator.get(id).visible) {
            this.editor.execute('projection.hide', id);
        }
        this.#collapsed = id;
        this.#notify();
    }

    #restore(): void {
        this.#requireOpenPair();
        if (this.#collapsed === undefined) return;
        const id = this.#collapsed;
        this.editor.execute('projection.show', id);
        this.#collapsed = undefined;
        this.#notify();
    }

    #focus(id: ProjectionId): void {
        const pair = this.#requireOpenPair();
        if (!pairIncludes(pair, id) || this.#collapsed === id) {
            throw new InvalidSplitViewTransitionError(
                `Projection "${id}" is not focusable in the current split view.`,
            );
        }
        if (id !== 'preview') {
            this.editor.execute('projection.activate', id);
        }
        this.#adapter?.focus(id);
    }

    #setOrientation(orientation: SplitOrientation): void {
        this.#assertAttached();
        if (this.#orientation === orientation) return;
        this.#orientation = orientation;
        this.#notify();
    }

    #setRatio(ratio: number): void {
        this.#requireOpenPair();
        if (this.#ratio === ratio) return;
        this.#ratio = ratio;
        this.#notify();
    }

    #subscribe(listener: (snapshot: SplitViewSnapshot) => void): () => void {
        this.#assertAlive();
        if (typeof listener !== 'function') {
            throw new TypeError('A split-view listener must be a function.');
        }
        this.#listeners.add(listener);
        let active = true;
        return () => {
            if (active) this.#listeners.delete(listener);
            active = false;
        };
    }

    #notify(): void {
        const snapshot = this.#snapshot();
        const errors: unknown[] = [];
        try {
            this.#adapter?.update(snapshot);
        } catch (error: unknown) {
            errors.push(error);
        }
        for (const listener of [...this.#listeners]) {
            try {
                listener(snapshot);
            } catch (error: unknown) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, 'Split-view notification failed.');
        }
    }

    #snapshot(): SplitViewSnapshot {
        this.#assertAlive();
        return Object.freeze({
            ...(this.#collapsed === undefined
                ? {}
                : { collapsed: this.#collapsed }),
            effectiveOrientation:
                this.#responsive && this.#orientation === 'horizontal'
                    ? 'vertical'
                    : this.#orientation,
            open: this.#open,
            orientation: this.#orientation,
            ...(this.#pair === undefined ? {} : { pair: this.#pair }),
            ratio: this.#ratio,
            responsive: this.#responsive,
        });
    }

    #requireOpenPair(): SplitViewPair {
        this.#assertAttached();
        if (!this.#open || this.#pair === undefined) {
            throw new InvalidSplitViewTransitionError(
                'A split view must be open before this action.',
            );
        }
        return this.#pair;
    }

    #assertAttached(): void {
        this.#assertAlive();
        if (this.#adapter === undefined) throw new SplitViewNotAttachedError();
    }

    #isAttached(): boolean {
        this.#assertAlive();
        return this.#adapter !== undefined;
    }

    #assertAlive(): void {
        if (this.#destroyed) throw new SplitViewDestroyedError();
    }
}

function isPairCompatible(
    pair: SplitViewPair,
    format: DocumentFormat,
): boolean {
    return format === 'html'
        ? pair === 'visual-source' || pair === 'source-preview'
        : pair === 'markdown-preview';
}

function pairIncludes(pair: SplitViewPair, id: ProjectionId): boolean {
    return (pairs[pair] as readonly ProjectionId[]).includes(id);
}

function validateAdapter(adapter: SplitViewAdapter): void {
    if (typeof adapter !== 'object' || adapter === null) {
        throw new TypeError('A split-view adapter must be an object.');
    }
    if (
        typeof adapter.focus !== 'function' ||
        typeof adapter.supports !== 'function' ||
        typeof adapter.update !== 'function'
    ) {
        throw new TypeError(
            'A split-view adapter requires focus, supports, and update functions.',
        );
    }
}

function readPair(command: string, args: readonly unknown[]): SplitViewPair {
    if (args.length !== 1 || !Object.hasOwn(pairs, String(args[0]))) {
        throw new TypeError(
            `Command "${command}" requires a supported split-view pair.`,
        );
    }
    return args[0] as SplitViewPair;
}

function readOrientation(
    command: string,
    args: readonly unknown[],
): SplitOrientation {
    if (
        args.length !== 1 ||
        (args[0] !== 'horizontal' && args[0] !== 'vertical')
    ) {
        throw new TypeError(
            `Command "${command}" requires "horizontal" or "vertical".`,
        );
    }
    return args[0];
}

function readRatio(command: string, args: readonly unknown[]): number {
    const ratio = args[0];
    if (
        args.length !== 1 ||
        typeof ratio !== 'number' ||
        !Number.isFinite(ratio) ||
        ratio < 20 ||
        ratio > 80
    ) {
        throw new TypeError(
            `Command "${command}" requires a ratio from 20 through 80.`,
        );
    }
    return ratio;
}

function readProjection(
    command: string,
    args: readonly unknown[],
): ProjectionId {
    const id = args[0];
    if (
        args.length !== 1 ||
        (id !== 'visual' &&
            id !== 'source' &&
            id !== 'markdown' &&
            id !== 'preview')
    ) {
        throw new TypeError(`Command "${command}" requires a projection ID.`);
    }
    return id;
}

function assertNoArguments(command: string, args: readonly unknown[]): void {
    if (args.length !== 0) {
        throw new TypeError(`Command "${command}" does not accept arguments.`);
    }
}
