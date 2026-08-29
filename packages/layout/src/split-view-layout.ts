import { ServiceAlreadyRegisteredError, type Editor } from '@soeditor/core';
import {
    projectionCoordinatorServiceToken,
    type ProjectionId,
} from '@soeditor/projections';

import {
    splitViewServiceToken,
    type SplitOrientation,
    type SplitViewAttachment,
    type SplitViewPair,
    type SplitViewSnapshot,
} from './split-view-plugin.js';

export type SplitViewHostMap = Partial<
    Readonly<Record<ProjectionId, HTMLElement>>
>;

export interface CreateSplitViewLayoutOptions {
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly hosts: SplitViewHostMap;
    readonly initialPair: SplitViewPair;
    readonly labels?: Partial<Readonly<Record<ProjectionId, string>>>;
    readonly orientation?: SplitOrientation;
    readonly ratio?: number;
    readonly responsiveBreakpoint?: number;
}

export interface SplitViewLayout {
    readonly element: HTMLElement;
    readonly destroyed: boolean;
    destroy(): void;
}

export class SplitViewLayoutDestroyedError extends Error {
    constructor() {
        super('The split-view layout has been destroyed.');
        this.name = 'SplitViewLayoutDestroyedError';
    }
}

export class SplitViewHostError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SplitViewHostError';
    }
}

const pairMembers = Object.freeze({
    'markdown-preview': ['markdown', 'preview'],
    'source-preview': ['source', 'preview'],
    'visual-source': ['visual', 'source'],
} satisfies Record<SplitViewPair, readonly [ProjectionId, ProjectionId]>);

const defaultLabels: Readonly<Record<ProjectionId, string>> = Object.freeze({
    markdown: 'Markdown',
    preview: 'Preview',
    source: 'HTML Source',
    visual: 'Visual',
});

interface HostOrigin {
    readonly anchor: Comment;
    readonly host: HTMLElement;
    readonly hidden: boolean;
}

class DomSplitViewLayout implements SplitViewLayout {
    readonly element: HTMLElement;
    readonly #attachment: SplitViewAttachment;
    readonly #editor: Editor;
    readonly #firstBody: HTMLElement;
    readonly #firstHeader: HTMLElement;
    readonly #firstPane: HTMLElement;
    readonly #hosts: SplitViewHostMap;
    readonly #origins: readonly HostOrigin[];
    readonly #previousAttributes: ReadonlyMap<string, string | null>;
    readonly #previousHidden: boolean;
    readonly #previousInverseRatio: string;
    readonly #previousLayoutClass: boolean;
    readonly #previousRatio: string;
    readonly #resizeObserver: ResizeObserver;
    readonly #responsiveBreakpoint: number;
    readonly #restoreButton: HTMLButtonElement;
    readonly #secondBody: HTMLElement;
    readonly #secondHeader: HTMLElement;
    readonly #secondPane: HTMLElement;
    readonly #separator: HTMLElement;
    readonly #disposeEditorDestroy: () => void;
    #destroyed = false;
    #dragging = false;
    #snapshot: SplitViewSnapshot | undefined;

    constructor(options: CreateSplitViewLayoutOptions) {
        validateOptions(options);
        this.#editor = options.editor;
        this.element = options.element;
        this.#hosts = options.hosts;
        this.#previousAttributes = new Map(
            ['role', 'aria-label', 'data-orientation', 'data-collapsed'].map(
                (name) => [name, this.element.getAttribute(name)],
            ),
        );
        this.#previousHidden = this.element.hidden;
        this.#previousLayoutClass = this.element.classList.contains(
            'soeditor-split-view',
        );
        this.#previousRatio = this.element.style.getPropertyValue(
            '--soeditor-split-ratio',
        );
        this.#previousInverseRatio = this.element.style.getPropertyValue(
            '--soeditor-split-inverse-ratio',
        );
        this.#responsiveBreakpoint =
            options.responsiveBreakpoint === undefined
                ? 640
                : readPositiveNumber(
                      'responsiveBreakpoint',
                      options.responsiveBreakpoint,
                  );
        const document = options.element.ownerDocument;
        const labels = normalizeLabels(options.labels);
        const origins = Object.values(options.hosts).map((host) => {
            if (host === undefined || host.parentNode === null) {
                throw new SplitViewHostError(
                    'Every split-view host must have an original parent.',
                );
            }
            const anchor = document.createComment('soeditor-split-origin');
            host.before(anchor);
            return { anchor, hidden: host.hidden, host };
        });
        this.#origins = Object.freeze(origins);

        this.element.classList.add('soeditor-split-view');
        this.element.setAttribute('role', 'group');
        this.element.setAttribute('aria-label', 'Editor split view');
        this.element.addEventListener('click', this.#handleLayoutClick);
        const controls = document.createElement('div');
        controls.className = 'soeditor-split-view__controls';
        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.className = 'soeditor-split-view__restore';
        restoreButton.textContent = 'Restore split pane';
        restoreButton.hidden = true;
        restoreButton.addEventListener('click', this.#handleRestore);
        controls.append(restoreButton);
        this.#restoreButton = restoreButton;

        const first = createPane(document, 'first');
        const second = createPane(document, 'second');
        this.#firstPane = first.pane;
        this.#firstHeader = first.header;
        this.#firstBody = first.body;
        this.#secondPane = second.pane;
        this.#secondHeader = second.header;
        this.#secondBody = second.body;
        const separator = document.createElement('div');
        separator.className = 'soeditor-split-view__separator';
        separator.setAttribute('role', 'separator');
        separator.setAttribute('aria-label', 'Resize editor panes');
        separator.setAttribute('aria-valuemin', '20');
        separator.setAttribute('aria-valuemax', '80');
        separator.tabIndex = 0;
        separator.addEventListener('keydown', this.#handleSeparatorKeyDown);
        separator.addEventListener('pointerdown', this.#handlePointerDown);
        this.#separator = separator;
        this.element.append(controls, first.pane, separator, second.pane);

        const service = options.editor.services.get(splitViewServiceToken);
        if (service.attached) {
            this.#restoreOrigins();
            this.element.replaceChildren();
            throw new ServiceAlreadyRegisteredError(splitViewServiceToken.id);
        }
        this.#attachment = service.attach({
            focus: (id) => this.#focus(id),
            supports: (pair) =>
                pairMembers[pair].every(
                    (id) => options.hosts[id] !== undefined,
                ),
            update: (snapshot) => this.#update(snapshot, options.hosts, labels),
        });
        const view = document.defaultView;
        if (view === null) {
            this.#attachment.destroy();
            this.#restoreOrigins();
            throw new SplitViewHostError(
                'The split-view root must be attached to a window.',
            );
        }
        this.#resizeObserver = new view.ResizeObserver(([entry]) => {
            if (entry !== undefined && !this.#destroyed) {
                this.#attachment.setResponsive(
                    entry.contentRect.width < this.#responsiveBreakpoint,
                );
            }
        });
        this.#resizeObserver.observe(this.element);
        this.#disposeEditorDestroy = options.editor.events.on(
            'editor:destroy',
            () => this.destroy(),
        );
        try {
            if (options.orientation !== undefined) {
                options.editor.execute(
                    'layout.split.orientation',
                    options.orientation,
                );
            }
            options.editor.execute('layout.split.open', options.initialPair);
            if (options.ratio !== undefined) {
                options.editor.execute('layout.split.resize', options.ratio);
            }
        } catch (error: unknown) {
            this.destroy();
            throw error;
        }
    }

    get destroyed(): boolean {
        return this.#destroyed;
    }

    destroy(): void {
        if (this.#destroyed) return;
        this.#destroyed = true;
        const errors: unknown[] = [];
        this.#stopDragging();
        this.#resizeObserver.disconnect();
        this.#separator.removeEventListener(
            'keydown',
            this.#handleSeparatorKeyDown,
        );
        this.#separator.removeEventListener(
            'pointerdown',
            this.#handlePointerDown,
        );
        this.#restoreButton.removeEventListener('click', this.#handleRestore);
        this.#disposeEditorDestroy();
        try {
            this.#attachment.destroy();
        } catch (error: unknown) {
            errors.push(error);
        }
        this.#restoreOrigins();
        this.element.replaceChildren();
        if (!this.#previousLayoutClass) {
            this.element.classList.remove('soeditor-split-view');
        }
        for (const [name, value] of this.#previousAttributes) {
            restoreAttribute(this.element, name, value);
        }
        this.element.removeEventListener('click', this.#handleLayoutClick);
        restoreStyleProperty(
            this.element,
            '--soeditor-split-ratio',
            this.#previousRatio,
        );
        restoreStyleProperty(
            this.element,
            '--soeditor-split-inverse-ratio',
            this.#previousInverseRatio,
        );
        this.element.hidden = this.#previousHidden;
        if (errors.length > 0) {
            throw new AggregateError(errors, 'Split-view cleanup failed.');
        }
    }

    #update(
        snapshot: SplitViewSnapshot,
        hosts: SplitViewHostMap,
        labels: Readonly<Record<ProjectionId, string>>,
    ): void {
        this.#snapshot = snapshot;
        const pair = snapshot.pair;
        if (pair === undefined) {
            this.element.hidden = true;
            return;
        }
        const [firstId, secondId] = pairMembers[pair];
        const firstHost = hosts[firstId];
        const secondHost = hosts[secondId];
        if (firstHost === undefined || secondHost === undefined) {
            throw new SplitViewHostError(`Hosts for "${pair}" are incomplete.`);
        }
        this.element.hidden = false;
        placeHost(this.#firstBody, firstHost);
        placeHost(this.#secondBody, secondHost);
        const primary = this.#editor.services.get(
            projectionCoordinatorServiceToken,
        ).snapshot.primary;
        updatePane(
            this.#firstPane,
            this.#firstHeader,
            firstId,
            labels[firstId],
            snapshot.collapsed !== undefined ||
                (firstId === primary && secondId === 'preview'),
        );
        updatePane(
            this.#secondPane,
            this.#secondHeader,
            secondId,
            labels[secondId],
            snapshot.collapsed !== undefined,
        );
        const collapsed = snapshot.open
            ? snapshot.collapsed
            : firstId === primary
              ? secondId
              : firstId;
        this.#firstPane.hidden = collapsed === firstId;
        this.#secondPane.hidden = collapsed === secondId;
        this.#separator.hidden = collapsed !== undefined || !snapshot.open;
        this.#restoreButton.hidden =
            snapshot.collapsed === undefined || !snapshot.open;
        this.element.dataset.collapsed =
            collapsed === firstId
                ? 'first'
                : collapsed === secondId
                  ? 'second'
                  : 'none';
        this.element.dataset.orientation = snapshot.effectiveOrientation;
        this.element.style.setProperty(
            '--soeditor-split-ratio',
            `${String(snapshot.ratio)}%`,
        );
        this.element.style.setProperty(
            '--soeditor-split-inverse-ratio',
            `${String(100 - snapshot.ratio)}%`,
        );
        this.#separator.setAttribute(
            'aria-orientation',
            snapshot.effectiveOrientation === 'horizontal'
                ? 'vertical'
                : 'horizontal',
        );
        this.#separator.setAttribute('aria-valuenow', String(snapshot.ratio));
    }

    readonly #handleLayoutClick = (event: MouseEvent): void => {
        const button = (event.target as Element | null)?.closest<HTMLElement>(
            'button[data-split-action][data-projection]',
        );
        const action = button?.dataset.splitAction;
        const id = button?.dataset.projection;
        if (
            (action !== 'focus' && action !== 'collapse') ||
            (id !== 'visual' &&
                id !== 'source' &&
                id !== 'markdown' &&
                id !== 'preview')
        ) {
            return;
        }
        this.#editor.execute(`layout.split.${action}`, id);
    };

    #focus(id: ProjectionId): void {
        this.#assertAlive();
        const host = this.#hosts[id];
        const target = host?.querySelector<HTMLElement>(
            '[contenteditable], iframe, input, textarea, button, [tabindex]',
        );
        (target ?? host)?.focus();
    }

    readonly #handleRestore = (): void => {
        this.#editor.execute('layout.split.restore');
    };

    readonly #handleSeparatorKeyDown = (event: KeyboardEvent): void => {
        const snapshot = this.#snapshot;
        if (snapshot === undefined) return;
        const delta =
            event.key === 'Home'
                ? 20 - snapshot.ratio
                : event.key === 'End'
                  ? 80 - snapshot.ratio
                  : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                    ? -5
                    : event.key === 'ArrowRight' || event.key === 'ArrowDown'
                      ? 5
                      : undefined;
        if (delta === undefined) return;
        event.preventDefault();
        this.#editor.execute(
            'layout.split.resize',
            Math.max(20, Math.min(80, snapshot.ratio + delta)),
        );
    };

    readonly #handlePointerDown = (event: PointerEvent): void => {
        if (event.button !== 0) return;
        event.preventDefault();
        this.#dragging = true;
        const document = this.element.ownerDocument;
        document.addEventListener('pointermove', this.#handlePointerMove);
        document.addEventListener('pointerup', this.#handlePointerUp);
    };

    readonly #handlePointerMove = (event: PointerEvent): void => {
        if (!this.#dragging || this.#snapshot === undefined) return;
        const rect = this.element.getBoundingClientRect();
        const horizontal = this.#snapshot.effectiveOrientation === 'horizontal';
        const size = horizontal ? rect.width : rect.height;
        if (size <= 0) return;
        const offset = horizontal
            ? event.clientX - rect.left
            : event.clientY - rect.top;
        const ratio = Math.max(20, Math.min(80, (offset / size) * 100));
        this.#editor.execute('layout.split.resize', Math.round(ratio));
    };

    readonly #handlePointerUp = (): void => this.#stopDragging();

    #stopDragging(): void {
        if (!this.#dragging) return;
        this.#dragging = false;
        const document = this.element.ownerDocument;
        document.removeEventListener('pointermove', this.#handlePointerMove);
        document.removeEventListener('pointerup', this.#handlePointerUp);
    }

    #restoreOrigins(): void {
        for (const { anchor, hidden, host } of this.#origins) {
            anchor.before(host);
            host.hidden = hidden;
            anchor.remove();
        }
    }

    #assertAlive(): void {
        if (this.#destroyed) throw new SplitViewLayoutDestroyedError();
    }
}

export function createSplitViewLayout(
    options: CreateSplitViewLayoutOptions,
): SplitViewLayout {
    return new DomSplitViewLayout(options);
}

function validateOptions(options: CreateSplitViewLayoutOptions): void {
    if (
        options.orientation !== undefined &&
        options.orientation !== 'horizontal' &&
        options.orientation !== 'vertical'
    ) {
        throw new TypeError('orientation must be "horizontal" or "vertical".');
    }
    if (options.ratio !== undefined) {
        readBoundedRatio(options.ratio);
    }
    if (options.element.childNodes.length !== 0) {
        throw new SplitViewHostError('The split-view root must be empty.');
    }
    const hosts = Object.values(options.hosts).filter(
        (host): host is HTMLElement => host !== undefined,
    );
    if (
        new Set(hosts).size !== hosts.length ||
        hosts.includes(options.element) ||
        hosts.some((host) => host.contains(options.element))
    ) {
        throw new SplitViewHostError(
            'Split-view hosts must be unique and cannot be the root.',
        );
    }
    const service = options.editor.services.get(splitViewServiceToken);
    if (service.attached) {
        throw new ServiceAlreadyRegisteredError(splitViewServiceToken.id);
    }
    const requiredPairs = [options.initialPair, service.snapshot.pair].filter(
        (pair): pair is SplitViewPair => pair !== undefined,
    );
    for (const pair of requiredPairs) {
        if (pairMembers[pair].some((id) => options.hosts[id] === undefined)) {
            throw new SplitViewHostError(
                `Hosts for split-view pair "${pair}" are incomplete.`,
            );
        }
    }
    if (options.element.ownerDocument.defaultView === null) {
        throw new SplitViewHostError(
            'The split-view root must be attached to a window.',
        );
    }
}

function normalizeLabels(
    labels?: Partial<Readonly<Record<ProjectionId, string>>>,
): Readonly<Record<ProjectionId, string>> {
    const result = { ...defaultLabels };
    for (const [id, label] of Object.entries(labels ?? {})) {
        if (
            id !== 'visual' &&
            id !== 'source' &&
            id !== 'markdown' &&
            id !== 'preview'
        ) {
            throw new TypeError(`Unknown split-view label ID "${id}".`);
        }
        if (typeof label !== 'string' || label.trim().length === 0) {
            throw new TypeError(`Split-view label "${id}" must not be empty.`);
        }
        result[id as ProjectionId] = label;
    }
    return Object.freeze(result);
}

function restoreAttribute(
    element: HTMLElement,
    name: string,
    value: string | null,
): void {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
}

function restoreStyleProperty(
    element: HTMLElement,
    name: string,
    value: string,
): void {
    if (value.length === 0) element.style.removeProperty(name);
    else element.style.setProperty(name, value);
}

function createPane(
    document: Document,
    suffix: string,
): {
    body: HTMLElement;
    header: HTMLElement;
    pane: HTMLElement;
} {
    const pane = document.createElement('section');
    pane.className = 'soeditor-split-view__pane';
    pane.setAttribute('role', 'region');
    const header = document.createElement('h2');
    header.className = 'soeditor-split-view__label';
    header.id = `soeditor-split-${suffix}-${String(nextLayoutId++)}`;
    pane.setAttribute('aria-labelledby', header.id);
    const actions = document.createElement('div');
    actions.className = 'soeditor-split-view__pane-actions';
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.dataset.splitAction = 'focus';
    focus.textContent = 'Focus';
    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.dataset.splitAction = 'collapse';
    collapse.textContent = 'Collapse';
    actions.append(focus, collapse);
    const chrome = document.createElement('header');
    chrome.className = 'soeditor-split-view__pane-header';
    chrome.append(header, actions);
    const body = document.createElement('div');
    body.className = 'soeditor-split-view__body';
    pane.append(chrome, body);
    return { body, header, pane };
}

let nextLayoutId = 1;

function updatePane(
    pane: HTMLElement,
    header: HTMLElement,
    id: ProjectionId,
    label: string,
    collapseDisabled: boolean,
): void {
    pane.dataset.projection = id;
    header.textContent = label;
    pane.querySelectorAll<HTMLButtonElement>(
        'button[data-split-action]',
    ).forEach((button) => {
        button.dataset.projection = id;
        button.setAttribute(
            'aria-label',
            `${button.textContent ?? ''} ${label}`,
        );
        if (button.dataset.splitAction === 'collapse') {
            button.disabled = collapseDisabled;
        }
    });
}

function placeHost(body: HTMLElement, host: HTMLElement): void {
    if (host.parentNode !== body) body.replaceChildren(host);
}

function readPositiveNumber(name: string, value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive finite number.`);
    }
    return value;
}

function readBoundedRatio(value: number): number {
    if (!Number.isFinite(value) || value < 20 || value > 80) {
        throw new TypeError(
            'ratio must be a finite number from 20 through 80.',
        );
    }
    return value;
}
