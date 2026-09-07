const VIEWPORT_MARGIN = 8;
const MINIMUM_WIDTH = 320;
const MINIMUM_HEIGHT = 192;
const KEYBOARD_STEP = 16;

interface DialogGeometry {
    readonly height: number;
    readonly left: number;
    readonly top: number;
    readonly width: number;
}

/** Adds optional, viewport-bounded window interactions to Classic dialogs. */
export function attachClassicDialogWindows(
    root: HTMLElement,
    translate: (message: string) => string,
    locale: string,
): () => void {
    const document = root.ownerDocument;
    const view = document.defaultView;
    if (view === null) return () => undefined;
    const disposers = new Map<HTMLDialogElement, () => void>();
    const enhance = (dialog: HTMLDialogElement): void => {
        if (disposers.has(dialog)) return;
        const title = dialog.querySelector<HTMLElement>(
            '.soeditor-ui__dialog-title',
        );
        if (title === null) return;
        const resizeHandle = document.createElement('button');
        resizeHandle.type = 'button';
        resizeHandle.className = 'soeditor-ui__dialog-resize-handle';
        resizeHandle.setAttribute(
            'aria-label',
            localize(
                translate,
                locale,
                'Resize dialog',
                '调整对话框大小',
                '調整對話框大小',
            ),
        );
        const previousTitle = title.getAttribute('title');
        const previousCursor = title.style.cursor;
        const previousTouchAction = title.style.touchAction;
        const previousUserSelect = title.style.userSelect;
        title.title = localize(
            translate,
            locale,
            'Drag to move dialog',
            '拖动标题可移动对话框',
            '拖曳標題可移動對話框',
        );
        title.style.cursor = 'move';
        title.style.touchAction = 'none';
        title.style.userSelect = 'none';
        dialog.append(resizeHandle);
        disposers.set(
            dialog,
            attachDialogInteractions(dialog, title, resizeHandle, () => {
                if (previousTitle === null) title.removeAttribute('title');
                else title.title = previousTitle;
                title.style.cursor = previousCursor;
                title.style.touchAction = previousTouchAction;
                title.style.userSelect = previousUserSelect;
                resizeHandle.remove();
            }),
        );
    };
    const scan = (node: Node): void => {
        if (!(node instanceof view.Element)) return;
        if (node instanceof view.HTMLDialogElement) {
            enhance(node);
        }
        node.querySelectorAll<HTMLDialogElement>(
            '.soeditor-ui__dialog',
        ).forEach(enhance);
    };
    scan(root);
    const observer = new view.MutationObserver((records) => {
        for (const record of records) {
            record.addedNodes.forEach(scan);
        }
        for (const [dialog, dispose] of disposers) {
            if (!dialog.isConnected) {
                dispose();
                disposers.delete(dialog);
            }
        }
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
        observer.disconnect();
        for (const dispose of disposers.values()) dispose();
        disposers.clear();
    };
}

function localize(
    translate: (message: string) => string,
    locale: string,
    message: string,
    simplifiedChinese: string,
    traditionalChinese: string,
): string {
    const translated = translate(message);
    if (translated !== message) return translated;
    if (locale.toLowerCase().startsWith('zh-tw')) return traditionalChinese;
    if (locale.toLowerCase().startsWith('zh')) return simplifiedChinese;
    return message;
}

function attachDialogInteractions(
    dialog: HTMLDialogElement,
    title: HTMLElement,
    resizeHandle: HTMLButtonElement,
    restore: () => void,
): () => void {
    const document = dialog.ownerDocument;
    const view = document.defaultView;
    if (view === null) return restore;
    let operation:
        | (DialogGeometry & {
              readonly kind: 'move' | 'resize';
              readonly pointerId: number;
              readonly startX: number;
              readonly startY: number;
          })
        | undefined;
    let explicitGeometry = false;

    const viewport = (): {
        readonly height: number;
        readonly width: number;
    } => ({
        height: document.documentElement.clientHeight || view.innerHeight,
        width: document.documentElement.clientWidth || view.innerWidth,
    });
    const apply = (geometry: DialogGeometry): void => {
        const available = viewport();
        const maximumWidth = Math.max(1, available.width - VIEWPORT_MARGIN * 2);
        const maximumHeight = Math.max(
            1,
            available.height - VIEWPORT_MARGIN * 2,
        );
        const width = clamp(
            geometry.width,
            Math.min(MINIMUM_WIDTH, maximumWidth),
            maximumWidth,
        );
        const height = clamp(
            geometry.height,
            Math.min(MINIMUM_HEIGHT, maximumHeight),
            maximumHeight,
        );
        const left = clamp(
            geometry.left,
            VIEWPORT_MARGIN,
            Math.max(
                VIEWPORT_MARGIN,
                available.width - width - VIEWPORT_MARGIN,
            ),
        );
        const top = clamp(
            geometry.top,
            VIEWPORT_MARGIN,
            Math.max(
                VIEWPORT_MARGIN,
                available.height - height - VIEWPORT_MARGIN,
            ),
        );
        explicitGeometry = true;
        dialog.style.inset = 'auto';
        dialog.style.margin = '0';
        dialog.style.left = `${String(left)}px`;
        dialog.style.top = `${String(top)}px`;
        dialog.style.width = `${String(width)}px`;
        dialog.style.height = `${String(height)}px`;
    };
    const current = (): DialogGeometry => {
        const rectangle = dialog.getBoundingClientRect();
        return {
            height: rectangle.height,
            left: rectangle.left,
            top: rectangle.top,
            width: rectangle.width,
        };
    };
    const start = (event: PointerEvent, kind: 'move' | 'resize'): void => {
        if (event.button !== 0) return;
        event.preventDefault();
        const geometry = current();
        apply(geometry);
        operation = {
            ...geometry,
            kind,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
        };
        dialog.dataset.interaction = kind;
    };
    const move = (event: PointerEvent): void => {
        if (
            operation === undefined ||
            operation.pointerId !== event.pointerId
        ) {
            return;
        }
        const deltaX = event.clientX - operation.startX;
        const deltaY = event.clientY - operation.startY;
        apply(
            operation.kind === 'move'
                ? {
                      ...operation,
                      left: operation.left + deltaX,
                      top: operation.top + deltaY,
                  }
                : {
                      ...operation,
                      height: operation.height + deltaY,
                      width: operation.width + deltaX,
                  },
        );
    };
    const stop = (event: PointerEvent): void => {
        if (
            operation === undefined ||
            operation.pointerId !== event.pointerId
        ) {
            return;
        }
        operation = undefined;
        delete dialog.dataset.interaction;
    };
    const resizeFromKeyboard = (event: KeyboardEvent): void => {
        const delta = {
            ArrowDown: { height: KEYBOARD_STEP, width: 0 },
            ArrowLeft: { height: 0, width: -KEYBOARD_STEP },
            ArrowRight: { height: 0, width: KEYBOARD_STEP },
            ArrowUp: { height: -KEYBOARD_STEP, width: 0 },
        }[event.key];
        if (delta === undefined) return;
        event.preventDefault();
        const geometry = current();
        apply({
            ...geometry,
            height: geometry.height + delta.height,
            width: geometry.width + delta.width,
        });
    };
    const keepInViewport = (): void => {
        if (explicitGeometry) apply(current());
    };
    const startMoving = (event: PointerEvent): void => start(event, 'move');
    const startResizing = (event: PointerEvent): void => start(event, 'resize');

    title.addEventListener('pointerdown', startMoving);
    resizeHandle.addEventListener('pointerdown', startResizing);
    resizeHandle.addEventListener('keydown', resizeFromKeyboard);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', stop);
    view.addEventListener('resize', keepInViewport);

    return () => {
        title.removeEventListener('pointerdown', startMoving);
        resizeHandle.removeEventListener('pointerdown', startResizing);
        resizeHandle.removeEventListener('keydown', resizeFromKeyboard);
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', stop);
        document.removeEventListener('pointercancel', stop);
        view.removeEventListener('resize', keepInViewport);
        restore();
    };
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}
