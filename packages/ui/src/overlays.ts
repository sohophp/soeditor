import type {
    BalloonOptions,
    BalloonService,
    DialogHandle,
    DialogOptions,
    DialogService,
    DismissibleUiHandle,
    NotificationOptions,
    NotificationService,
    UiContent,
} from './types.js';
import { EditorUiDestroyedError } from './errors.js';

export interface OverlayServices {
    readonly balloons: BalloonService;
    readonly dialogs: DialogService;
    readonly notifications: NotificationService;
    destroy(): void;
}

export function createOverlayServices(
    document: Document,
    layer: HTMLElement,
    notificationRegion: HTMLElement,
): OverlayServices {
    const handles = new Set<DismissibleUiHandle>();
    const balloonAnchors = new Map<DismissibleUiHandle, Element>();
    let destroyed = false;
    const assertAlive = (): void => {
        if (destroyed) {
            throw new EditorUiDestroyedError();
        }
    };
    const dismissBalloons = (event: Event): void => {
        const path = event.composedPath();
        for (const [handle, anchor] of [...balloonAnchors]) {
            if (!path.includes(handle.element) && !path.includes(anchor)) {
                handle.close();
            }
        }
    };
    document.addEventListener('pointerdown', dismissBalloons, true);
    document.addEventListener('focusin', dismissBalloons, true);

    const notifications: NotificationService = Object.freeze({
        show: (options: NotificationOptions) => {
            assertAlive();
            validateNotification(options);
            const element = document.createElement('div');
            element.className = 'soeditor-ui__notification';
            element.dataset.severity = options.severity ?? 'info';
            element.textContent = options.message;
            const close = once(() => {
                clearTimeout(timer);
                element.remove();
                handles.delete(handle);
            });
            const handle: DismissibleUiHandle = Object.freeze({
                element,
                close,
            });
            const duration = options.duration ?? 4_000;
            const timer = setTimeout(close, duration);
            notificationRegion.append(element);
            handles.add(handle);
            return handle;
        },
    });

    const dialogs: DialogService = Object.freeze({
        open: (options: DialogOptions) => {
            assertAlive();
            validateDialog(options);
            const returnFocus = options.returnFocus ?? document.activeElement;
            const dialog = document.createElement('dialog');
            dialog.className = 'soeditor-ui__dialog';
            dialog.setAttribute('aria-label', options.title);
            const title = document.createElement('h2');
            title.className = 'soeditor-ui__dialog-title';
            title.textContent = options.title;
            const body = document.createElement('div');
            body.className = 'soeditor-ui__dialog-body';
            appendContent(body, options.content);
            const footer = document.createElement('div');
            footer.className = 'soeditor-ui__dialog-actions';
            const close = once(() => {
                if (dialog.open) {
                    dialog.close();
                }
                dialog.remove();
                handles.delete(handle);
                const view = document.defaultView;
                if (
                    !destroyed &&
                    view !== null &&
                    returnFocus instanceof view.HTMLElement &&
                    returnFocus.isConnected
                ) {
                    returnFocus.focus({ preventScroll: true });
                }
            });
            const handle: DialogHandle = Object.freeze({
                element: dialog,
                close,
            });
            for (const action of options.actions ?? []) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'soeditor-ui__dialog-action';
                button.classList.toggle(
                    'is-primary',
                    action.kind === 'primary',
                );
                button.classList.toggle('is-danger', action.kind === 'danger');
                button.textContent = action.label;
                button.addEventListener('click', () => {
                    try {
                        const result = action.run(handle);
                        if (isPromiseLike(result)) {
                            button.disabled = true;
                            void Promise.resolve(result).then(
                                () => {
                                    button.disabled = false;
                                },
                                (error: unknown) => {
                                    button.disabled = false;
                                    if (!destroyed) {
                                        notifications.show({
                                            message: errorMessage(error),
                                            severity: 'error',
                                        });
                                    }
                                },
                            );
                        }
                    } catch (error: unknown) {
                        if (!destroyed) {
                            notifications.show({
                                message: errorMessage(error),
                                severity: 'error',
                            });
                        }
                    }
                });
                footer.append(button);
            }
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'soeditor-ui__dialog-action';
            cancel.textContent = 'Cancel';
            cancel.addEventListener('click', close);
            footer.append(cancel);
            dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                close();
            });
            dialog.append(title, body, footer);
            layer.append(dialog);
            handles.add(handle);
            try {
                dialog.showModal();
            } catch (error: unknown) {
                close();
                throw error;
            }
            return handle;
        },
    });

    const balloons: BalloonService = Object.freeze({
        show: (options: BalloonOptions) => {
            assertAlive();
            if (!options.anchor.isConnected) {
                throw new TypeError('A balloon anchor must be connected.');
            }
            const element = document.createElement('div');
            element.className = 'soeditor-ui__balloon';
            element.setAttribute('role', 'dialog');
            appendContent(element, options.content);
            const reposition = (): void => {
                const rectangle = options.anchor.getBoundingClientRect();
                const view = document.defaultView;
                const gap = 8;
                const margin = 8;
                const width = element.offsetWidth;
                const height = element.offsetHeight;
                const viewportWidth =
                    view?.innerWidth ?? document.documentElement.clientWidth;
                const viewportHeight =
                    view?.innerHeight ?? document.documentElement.clientHeight;
                const above = rectangle.top - height - gap;
                const below = rectangle.bottom + gap;
                const preferAbove = options.placement === 'above';
                const useAbove = preferAbove
                    ? above >= margin ||
                      below + height > viewportHeight - margin
                    : below + height > viewportHeight - margin &&
                      above >= margin;
                const top = useAbove ? above : below;
                const centered =
                    rectangle.left + rectangle.width / 2 - width / 2;
                const left = Math.max(
                    margin,
                    Math.min(centered, viewportWidth - width - margin),
                );
                element.dataset.placement = useAbove ? 'above' : 'below';
                element.style.left = `${String(left)}px`;
                element.style.top = `${String(
                    Math.max(
                        margin,
                        Math.min(top, viewportHeight - height - margin),
                    ),
                )}px`;
            };
            const view = document.defaultView;
            const close = once(() => {
                view?.removeEventListener('resize', reposition);
                view?.removeEventListener('scroll', reposition, true);
                element.remove();
                handles.delete(handle);
                balloonAnchors.delete(handle);
            });
            const handle: DismissibleUiHandle = Object.freeze({
                element,
                close,
            });
            layer.append(element);
            view?.addEventListener('resize', reposition);
            view?.addEventListener('scroll', reposition, true);
            reposition();
            handles.add(handle);
            balloonAnchors.set(handle, options.anchor);
            return handle;
        },
    });

    return Object.freeze({
        balloons,
        dialogs,
        notifications,
        destroy: () => {
            if (destroyed) {
                return;
            }
            destroyed = true;
            document.removeEventListener('pointerdown', dismissBalloons, true);
            document.removeEventListener('focusin', dismissBalloons, true);
            for (const handle of [...handles]) {
                handle.close();
            }
        },
    });
}

function appendContent(container: HTMLElement, content?: UiContent): void {
    if (content === undefined) {
        return;
    }
    if (typeof content === 'string') {
        container.textContent = content;
    } else if (typeof content === 'function') {
        content(container);
    } else {
        container.append(content);
    }
}

function validateNotification(options: NotificationOptions): void {
    if (options.message.length === 0) {
        throw new TypeError('A notification message must not be empty.');
    }
    if (
        options.duration !== undefined &&
        (!Number.isFinite(options.duration) || options.duration < 0)
    ) {
        throw new TypeError('Notification duration must be non-negative.');
    }
}

function validateDialog(options: DialogOptions): void {
    if (options.title.length === 0) {
        throw new TypeError('A dialog title must not be empty.');
    }
    for (const action of options.actions ?? []) {
        if (action.label.length === 0 || typeof action.run !== 'function') {
            throw new TypeError(
                'A dialog action requires a label and handler.',
            );
        }
    }
}

function once(callback: () => void): () => void {
    let active = true;
    return () => {
        if (active) {
            active = false;
            callback();
        }
    };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (typeof value === 'object' && value !== null) ||
        typeof value === 'function'
        ? typeof Reflect.get(value, 'then') === 'function'
        : false;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
