import type { EditorUi } from '@soeditor/ui';

/** Projection-only type-around controls shared by the lazy image/table tools. */
export function attachBlockParagraphContext(
    ui: EditorUi,
    visual: HTMLElement,
    initialEvent?: Pick<Event, 'target' | 'type'>,
): () => void {
    const document = visual.ownerDocument;
    const view = document.defaultView;
    const root = visual.getRootNode();
    let overlay: HTMLElement | undefined;
    let block: Element | undefined;
    let imageAnchor: HTMLImageElement | undefined;
    let frame: number | undefined;
    let hoverBounds:
        | { left: number; right: number; top: number; bottom: number }
        | undefined;
    const clear = (): void => {
        overlay?.remove();
        overlay = undefined;
        block = undefined;
        imageAnchor = undefined;
        hoverBounds = undefined;
        observer?.disconnect();
        resizeObserver?.disconnect();
        if (frame !== undefined) view?.cancelAnimationFrame(frame);
        frame = undefined;
    };
    const position = (): void => {
        frame = undefined;
        if (
            block?.isConnected !== true ||
            !visual.isContentEditable ||
            visual.getClientRects().length === 0
        ) {
            clear();
            return;
        }
        if (overlay === undefined) return;
        const blockBounds = block.getBoundingClientRect();
        const bounds = imageAnchor?.getBoundingClientRect() ?? blockBounds;
        const bottom =
            imageAnchor !== undefined && block.tagName === 'FIGURE'
                ? Math.max(
                      bounds.bottom,
                      block.querySelector('figcaption')?.getBoundingClientRect()
                          .bottom ?? bounds.bottom,
                  )
                : bounds.bottom;
        const host =
            overlay.offsetParent instanceof HTMLElement
                ? overlay.offsetParent
                : ui.element;
        const origin = host.getBoundingClientRect();
        // Viewport rectangles include host zoom; absolute offsets do not.
        const scale =
            host.offsetWidth > 0 ? origin.width / host.offsetWidth : 1;
        overlay.style.left = `${String((bounds.left - origin.left) / scale - host.clientLeft + host.scrollLeft)}px`;
        overlay.style.top = `${String((bounds.top - origin.top) / scale - host.clientTop + host.scrollTop)}px`;
        overlay.style.width = `${String(bounds.width / scale)}px`;
        overlay.style.height = `${String((bottom - bounds.top) / scale)}px`;
        // Keep table text and short/broken images clear of the controls.
        overlay.style.setProperty(
            '--soeditor-block-offset',
            block.tagName === 'TABLE' ||
                (imageAnchor !== undefined &&
                    (bottom - bounds.top) / scale < 48)
                ? '-24px'
                : '-12px',
        );
        // Cache the button corridor; pointer movement must not force layout.
        const buttons = Array.from(
            overlay.querySelectorAll('button'),
            (button) => button.getBoundingClientRect(),
        );
        hoverBounds = {
            left: Math.min(bounds.left, ...buttons.map((rect) => rect.left)),
            right: Math.max(bounds.right, ...buttons.map((rect) => rect.right)),
            top: Math.min(bounds.top, ...buttons.map((rect) => rect.top)),
            bottom: Math.max(bottom, ...buttons.map((rect) => rect.bottom)),
        };
    };
    const schedule = (): void => {
        if (overlay !== undefined && frame === undefined)
            frame = view?.requestAnimationFrame(position);
    };
    const observer =
        view === null ? undefined : new view.MutationObserver(schedule);
    const resizeObserver =
        view === null ? undefined : new view.ResizeObserver(schedule);
    const select = (event: Pick<Event, 'target' | 'type'>): void => {
        const detail: unknown = Reflect.get(event, 'detail');
        const target = event.target;
        if (
            typeof detail !== 'object' ||
            detail === null ||
            !(target instanceof Element)
        )
            return;
        const insert: unknown = Reflect.get(detail, 'insertParagraph');
        if (typeof insert !== 'function' || !visual.isContentEditable) return;
        const image = target.closest('img');
        const boundary: unknown = Reflect.get(detail, 'block');
        if (
            !(boundary instanceof Element) ||
            !visual.contains(boundary) ||
            !(root instanceof ShadowRoot)
        )
            return;
        if (block === boundary && overlay !== undefined) {
            if (event.type !== 'soeditor:table-selection')
                overlay.classList.add('is-hovered');
            return;
        }
        clear();
        block = boundary;
        if (
            image !== null &&
            (boundary.tagName === 'FIGURE' ||
                boundary.textContent?.trim() === '')
        )
            imageAnchor = image;
        overlay = document.createElement('div');
        overlay.className = 'soeditor-block-paragraph is-hovered';
        overlay.setAttribute(
            'data-block-kind',
            image !== null ? 'image' : 'table',
        );
        for (const side of ['before', 'after'] as const) {
            const button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('data-insert-paragraph', side);
            const label = ui.translate(
                side === 'before'
                    ? 'Insert paragraph before this block'
                    : 'Insert paragraph after this block',
            );
            button.addEventListener('focus', () =>
                overlay?.classList.add('is-hovered'),
            );
            button.title = label;
            button.setAttribute('aria-label', label);
            button.textContent = '↵';
            button.addEventListener('pointerdown', (event) =>
                event.preventDefault(),
            );
            button.addEventListener('click', () => {
                Reflect.apply(insert, undefined, [side]);
                clear();
            });
            button.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                clear();
                visual.focus({ preventScroll: true });
            });
            overlay.append(button);
        }
        root.append(overlay);
        observer?.observe(visual, {
            attributes: true,
            childList: true,
            subtree: true,
        });
        resizeObserver?.observe(boundary);
        if (imageAnchor !== undefined) resizeObserver?.observe(imageAnchor);
        resizeObserver?.observe(visual);
        resizeObserver?.observe(root.host);
        position();
    };
    const dismiss = (event: Event): void => {
        const target = event.composedPath()[0];
        if (
            overlay === undefined ||
            event.composedPath().includes(overlay) ||
            (target instanceof Node && block?.contains(target) === true) ||
            (target instanceof Element &&
                target.closest('.soeditor-image-resize-overlay') !== null)
        )
            return;
        clear();
    };
    const hover = (event: Event): void => {
        if (event instanceof PointerEvent && event.pointerType === 'touch')
            return;
        const target =
            event.type === 'pointerout' && event instanceof MouseEvent
                ? event.relatedTarget
                : event.composedPath()[0];
        const inCorridor =
            event instanceof MouseEvent &&
            event.type !== 'blur' &&
            hoverBounds !== undefined &&
            event.clientX >= hoverBounds.left &&
            event.clientX <= hoverBounds.right &&
            event.clientY >= hoverBounds.top &&
            event.clientY <= hoverBounds.bottom;
        overlay?.classList.toggle(
            'is-hovered',
            inCorridor ||
                (target instanceof Node &&
                    ((imageAnchor ?? block)?.contains(target) === true ||
                        (imageAnchor !== undefined &&
                            block
                                ?.querySelector('figcaption')
                                ?.contains(target) === true) ||
                        overlay.contains(target))),
        );
    };
    document.addEventListener('pointermove', hover);
    view?.addEventListener('blur', hover);
    root.addEventListener('pointerout', hover);
    visual.addEventListener('soeditor:block-hover', select);
    visual.addEventListener('soeditor:image-select', select);
    visual.addEventListener('soeditor:table-selection', select);
    document.addEventListener('pointerdown', dismiss, true);
    root.addEventListener('focusin', dismiss);
    document.addEventListener('scroll', schedule, true);
    view?.addEventListener('resize', schedule);
    if (initialEvent !== undefined) select(initialEvent);
    return () => {
        clear();
        document.removeEventListener('pointermove', hover);
        view?.removeEventListener('blur', hover);
        root.removeEventListener('pointerout', hover);
        visual.removeEventListener('soeditor:block-hover', select);
        visual.removeEventListener('soeditor:image-select', select);
        visual.removeEventListener('soeditor:table-selection', select);
        document.removeEventListener('pointerdown', dismiss, true);
        root.removeEventListener('focusin', dismiss);
        document.removeEventListener('scroll', schedule, true);
        view?.removeEventListener('resize', schedule);
    };
}
