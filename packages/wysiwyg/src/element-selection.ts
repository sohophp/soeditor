import type { VisualElementPathEntry } from '@soeditor/engine';

const removable =
    /^(h[1-6]|p|div|span|blockquote|strong|b|em|i|u|s|strike|sub|sup|font)$/u;
const protectedSelector =
    '[contenteditable="false"],[data-soeditor-component],[data-cms-component],[data-editor-component],[data-soeditor-element]';

/** Projection-local handles and a single, non-content selection affordance. */
export class ElementSelection {
    readonly #root: HTMLElement;
    readonly #prefix = Array.from(
        crypto.getRandomValues(new Uint32Array(2)),
    ).join('-');
    #sequence = 0;
    #handles = new Map<string, HTMLElement>();
    #ids = new WeakMap<HTMLElement, string>();
    #path: HTMLElement[] = [];
    #selected: HTMLElement | undefined;
    #overlay: HTMLDivElement | undefined;
    #frame: number | undefined;
    #observer: ResizeObserver | undefined;
    #destroyed = false;
    readonly #empty = new Map<HTMLElement, HTMLButtonElement>();
    readonly #activate: (id: string) => void;
    readonly #isProtected: (element: HTMLElement) => boolean;

    constructor(
        root: HTMLElement,
        activate: (id: string) => void,
        isProtected: (element: HTMLElement) => boolean = () => false,
    ) {
        this.#root = root;
        this.#activate = activate;
        this.#isProtected = isProtected;
        root.ownerDocument.addEventListener('scroll', this.#schedule, true);
        root.ownerDocument.addEventListener('pointerdown', this.#outside, true);
        root.ownerDocument.addEventListener('focusin', this.#outside, true);
        root.ownerDocument.defaultView?.addEventListener(
            'resize',
            this.#schedule,
        );
    }

    get selected(): HTMLElement | undefined {
        return this.#selected?.isConnected &&
            this.#root.contains(this.#selected)
            ? this.#selected
            : undefined;
    }

    read(
        range: Range | undefined,
        canEdit: boolean,
    ): readonly VisualElementPathEntry[] {
        if (this.#root.hidden || this.#destroyed) {
            for (const button of this.#empty.values()) button.hidden = true;
            this.clear();
            return [];
        }
        if (this.selected === undefined) {
            let node = range?.commonAncestorContainer;
            if (
                range &&
                !range.collapsed &&
                range.startContainer === range.endContainer &&
                range.endOffset === range.startOffset + 1
            )
                node =
                    range.startContainer.childNodes[range.startOffset] ?? node;
            let element =
                node instanceof HTMLElement ? node : node?.parentElement;
            const path: HTMLElement[] = [];
            while (
                element &&
                element !== this.#root &&
                this.#root.contains(element)
            ) {
                path.push(element);
                element = element.parentElement;
            }
            this.#path = element === this.#root ? path.reverse() : [];
            this.#handles.clear();
        }
        return this.#path
            .filter((element) => this.#root.contains(element))
            .map((element) => {
                let id = this.#ids.get(element);
                if (!id) {
                    id = `${this.#prefix}:${++this.#sequence}`;
                    this.#ids.set(element, id);
                }
                this.#handles.set(id, element);
                const safe = this.canUnwrap(element);
                return {
                    id,
                    tagName:
                        element.dataset.soeditorElement ?? element.localName,
                    selected: element === this.selected,
                    canUnwrap: safe && canEdit,
                    ...(!safe
                        ? {
                              unavailableReason:
                                  'This element cannot be unwrapped',
                          }
                        : !canEdit
                          ? { unavailableReason: 'Editing is unavailable' }
                          : {}),
                };
            });
    }

    resolve(id: unknown): HTMLElement | undefined {
        if (typeof id !== 'string' || this.#destroyed || this.#root.hidden)
            return undefined;
        const element = this.#handles.get(id);
        return element && this.#root.contains(element) ? element : undefined;
    }

    canUnwrap(element: HTMLElement): boolean {
        return (
            element !== this.#root &&
            this.#root.contains(element) &&
            removable.test(element.localName) &&
            element.closest(protectedSelector) === null &&
            !this.#isProtected(element)
        );
    }

    select(element: HTMLElement): void {
        this.#selected = element;
        if (!this.#overlay) {
            const overlay = this.#root.ownerDocument.createElement('div');
            overlay.className = 'soeditor-element-selection';
            overlay.setAttribute('aria-hidden', 'true');
            const label = this.#root.ownerDocument.createElement('span');
            overlay.append(label);
            this.#root.ownerDocument.body.append(overlay);
            this.#overlay = overlay;
        }
        this.#overlay.firstChild!.textContent = element.localName;
        this.#observer?.disconnect();
        const Observer = this.#root.ownerDocument.defaultView?.ResizeObserver;
        if (Observer) {
            this.#observer ??= new Observer(this.#schedule);
            this.#observer.observe(element);
            this.#observer.observe(this.#root);
        }
        this.#schedule();
    }

    registerEmpty(element: HTMLElement): void {
        if (
            !removable.test(element.localName) ||
            element.childNodes.length !== 0
        )
            return;
        const button = this.#root.ownerDocument.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-empty-element';
        button.textContent = element.localName;
        button.setAttribute('aria-label', element.localName);
        button.hidden = true;
        button.addEventListener('click', () => {
            const range = this.#root.ownerDocument.createRange();
            range.selectNodeContents(element);
            this.clear();
            const entry = this.read(range, true).at(-1);
            if (entry) this.#activate(entry.id);
        });
        this.#empty.set(element, button);
        this.#root.ownerDocument.body.append(button);
        const Observer = this.#root.ownerDocument.defaultView?.ResizeObserver;
        if (Observer) {
            this.#observer ??= new Observer(this.#schedule);
            this.#observer.observe(this.#root);
        }
        this.#schedule();
    }

    refresh(): void {
        this.#schedule();
    }

    resetProjection(): void {
        this.invalidate();
        for (const button of this.#empty.values()) button.remove();
        this.#empty.clear();
        this.#observer?.disconnect();
    }

    clear(): void {
        this.#selected = undefined;
        if (this.#overlay) this.#overlay.hidden = true;
        this.#observer?.disconnect();
        if (this.#empty.size) this.#observer?.observe(this.#root);
        if (this.#frame !== undefined)
            this.#root.ownerDocument.defaultView?.cancelAnimationFrame(
                this.#frame,
            );
        this.#frame = undefined;
    }

    invalidate(): void {
        this.clear();
        this.#path = [];
        this.#handles.clear();
        this.#ids = new WeakMap();
    }

    destroy(): void {
        this.resetProjection();
        this.#destroyed = true;
        this.#overlay?.remove();
        this.#root.ownerDocument.removeEventListener(
            'scroll',
            this.#schedule,
            true,
        );
        this.#root.ownerDocument.removeEventListener(
            'pointerdown',
            this.#outside,
            true,
        );
        this.#root.ownerDocument.removeEventListener(
            'focusin',
            this.#outside,
            true,
        );
        this.#root.ownerDocument.defaultView?.removeEventListener(
            'resize',
            this.#schedule,
        );
    }

    readonly #schedule = (): void => {
        const view = this.#root.ownerDocument.defaultView;
        if (
            !view ||
            this.#frame !== undefined ||
            (!this.selected && this.#empty.size === 0)
        )
            return;
        this.#frame = view.requestAnimationFrame(() => {
            this.#frame = undefined;
            const scope = this.#root.getRootNode();
            const rootRect = (
                scope instanceof ShadowRoot ? scope.host : this.#root
            ).getBoundingClientRect();
            const geometry: {
                button: HTMLButtonElement;
                rect: DOMRect;
                hidden: boolean;
            }[] = [];
            for (const [element, button] of this.#empty) {
                if (!this.#root.contains(element)) {
                    button.remove();
                    this.#empty.delete(element);
                    continue;
                }
                const rect = element.getBoundingClientRect();
                const hidden =
                    this.#root.hidden ||
                    element.childNodes.length !== 0 ||
                    rect.top < rootRect.top ||
                    rect.top > rootRect.bottom;
                geometry.push({ button, rect, hidden });
            }
            const element = this.selected;
            const overlay = this.#overlay;
            const rect = element?.getBoundingClientRect();
            for (const { button, rect, hidden } of geometry) {
                button.hidden = hidden;
                button.style.left = `${Math.max(rootRect.left, rect.left)}px`;
                button.style.top = `${rect.top}px`;
            }
            if (!rect || !overlay || this.#root.hidden) {
                if (overlay) overlay.hidden = true;
                return;
            }
            const left = Math.max(rect.left, rootRect.left);
            const top = Math.max(rect.top, rootRect.top);
            const right = Math.min(rect.right, rootRect.right);
            const bottom = Math.min(
                Math.max(rect.bottom, rect.top + 16),
                rootRect.bottom,
            );
            overlay.hidden = right <= left || bottom <= top;
            Object.assign(overlay.style, {
                left: `${left}px`,
                top: `${top}px`,
                width: `${right - left}px`,
                height: `${bottom - top}px`,
            });
        });
    };

    readonly #outside = (event: Event): void => {
        const scope = this.#root.getRootNode();
        const host = (
            scope instanceof ShadowRoot ? scope.host : this.#root
        ).closest('.soeditor-classic');
        if (
            host &&
            !event.composedPath().includes(host) &&
            !(
                event.target instanceof HTMLButtonElement &&
                Array.from(this.#empty.values()).includes(event.target)
            )
        )
            this.clear();
    };
}
