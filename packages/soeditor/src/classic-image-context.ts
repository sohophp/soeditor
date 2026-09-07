import type { DismissibleUiHandle, EditorUi } from '@soeditor/ui';

export function attachClassicImageContext(
    ui: EditorUi,
    visual: HTMLElement,
    initialEvent?: Pick<Event, 'target' | 'type'>,
): () => void {
    const document = visual.ownerDocument;
    const view = document.defaultView;
    const shadow = visual.getRootNode();
    let resizeOverlay: HTMLElement | undefined;
    let selectedImage: HTMLImageElement | undefined;
    let cancelDrag: (() => void) | undefined;
    let positionFrame: number | undefined;
    let imageTools: DismissibleUiHandle | undefined;
    let showImageTools: (() => void) | undefined;
    const removeResizeOverlay = (): void => {
        cancelDrag?.();
        showImageTools = undefined;
        imageTools?.close();
        imageTools = undefined;
        resizeOverlay?.remove();
        resizeOverlay = undefined;
        selectedImage = undefined;
        observer?.disconnect();
        resizeObserver?.disconnect();
        if (positionFrame !== undefined)
            view?.cancelAnimationFrame(positionFrame);
        positionFrame = undefined;
    };
    const positionResizeOverlay = (): void => {
        positionFrame = undefined;
        if (resizeOverlay === undefined) return;
        if (
            selectedImage?.isConnected !== true ||
            !visual.isContentEditable ||
            visual.getClientRects().length === 0
        ) {
            removeResizeOverlay();
            return;
        }
        // Scroll/layout observation must never reset an active drag preview.
        if (cancelDrag !== undefined) return;
        const rectangle = selectedImage.getBoundingClientRect();
        const containingBlock =
            resizeOverlay.offsetParent instanceof HTMLElement
                ? resizeOverlay.offsetParent
                : ui.element;
        const containingRectangle = containingBlock.getBoundingClientRect();
        resizeOverlay.style.left = `${String(rectangle.left - containingRectangle.left - containingBlock.clientLeft + containingBlock.scrollLeft)}px`;
        resizeOverlay.style.top = `${String(rectangle.top - containingRectangle.top - containingBlock.clientTop + containingBlock.scrollTop)}px`;
        resizeOverlay.style.inlineSize = `${String(rectangle.width)}px`;
        resizeOverlay.style.blockSize = `${String(rectangle.height)}px`;
        showImageTools?.();
    };
    const schedulePosition = (): void => {
        if (resizeOverlay !== undefined && positionFrame === undefined)
            positionFrame = view?.requestAnimationFrame(positionResizeOverlay);
    };
    const observer =
        view === null ? undefined : new view.MutationObserver(schedulePosition);
    const resizeObserver =
        view === null ? undefined : new view.ResizeObserver(schedulePosition);
    const select = (event: Pick<Event, 'target' | 'type'>): void => {
        const detail: unknown = Reflect.get(event, 'detail');
        if (typeof detail !== 'object' || detail === null) return;
        const element: unknown = Reflect.get(detail, 'element');
        const update: unknown = Reflect.get(detail, 'update');
        if (
            !(element instanceof HTMLImageElement) ||
            !visual.contains(element) ||
            !visual.isContentEditable ||
            typeof update !== 'function' ||
            !(shadow instanceof ShadowRoot)
        )
            return;
        removeResizeOverlay();
        selectedImage = element;
        showImageTools = (): void => {
            if (imageTools?.element.isConnected) return;
            imageTools = ui.balloons.show({
                anchor: element,
                placement: 'above',
                avoid: () =>
                    Array.from(
                        overlay.querySelectorAll(
                            '.soeditor-image-resize-handle',
                        ),
                        (handle) => handle.getBoundingClientRect(),
                    ),
                content: (container) => {
                    container.setAttribute('data-image-tools', 'true');
                    container.setAttribute('role', 'toolbar');
                    container.setAttribute(
                        'aria-label',
                        ui.translate('Image tools'),
                    );
                    container.style.display = 'flex';
                    container.style.gap = '0.125rem';
                    const buttons: HTMLButtonElement[] = [];
                    for (const [value, label, icon] of [
                        ['left', 'Align left', 'format.alignment.left'],
                        ['center', 'Align center', 'format.alignment.center'],
                        ['right', 'Align right', 'format.alignment.right'],
                        ['properties', 'Image properties', 'image.insert'],
                    ] as const) {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.className = 'soeditor-ui__button';
                        button.setAttribute('aria-label', ui.translate(label));
                        button.title = ui.translate(label);
                        ui.setIcon(button, icon, label);
                        if (value !== 'properties')
                            button.setAttribute(
                                'aria-pressed',
                                String(
                                    element
                                        .closest('figure')
                                        ?.getAttribute('data-align') === value,
                                ),
                            );
                        button.addEventListener('click', () => {
                            if (
                                !visual.isContentEditable ||
                                !element.isConnected
                            )
                                return;
                            if (value === 'properties') {
                                removeResizeOverlay();
                                activate(event);
                            } else {
                                ui.restoreEditingSelection();
                                Reflect.apply(update, undefined, [
                                    { alignment: value },
                                ]);
                                imageTools?.close();
                                imageTools = undefined;
                                positionResizeOverlay();
                            }
                        });
                        buttons.push(button);
                        container.append(button);
                    }
                    container.addEventListener('keydown', (key) => {
                        if (
                            ![
                                'ArrowLeft',
                                'ArrowRight',
                                'Home',
                                'End',
                            ].includes(key.key)
                        )
                            return;
                        const current = buttons.findIndex(
                            (button) => button === document.activeElement,
                        );
                        const forward =
                            (key.key === 'ArrowRight') !==
                            (getComputedStyle(container).direction === 'rtl');
                        const next =
                            key.key === 'Home'
                                ? 0
                                : key.key === 'End'
                                  ? buttons.length - 1
                                  : (current +
                                        (forward ? 1 : -1) +
                                        buttons.length) %
                                    buttons.length;
                        key.preventDefault();
                        key.stopPropagation();
                        buttons[next]?.focus();
                    });
                },
            });
        };
        const overlay = document.createElement('div');
        overlay.className = 'soeditor-image-resize-overlay';
        // Hide only this projected image while previewing, without mutating
        // its attributes or waking the document's content observer per frame.
        const path: string[] = [];
        let node: Element = element;
        while (node !== visual && node.parentElement !== null) {
            path.unshift(
                `:nth-child(${String(Array.from(node.parentElement.children).indexOf(node) + 1)})`,
            );
            node = node.parentElement;
        }
        const conceal = document.createElement('style');
        const nonce =
            shadow.querySelector<HTMLStyleElement>('style[nonce]')?.nonce;
        if (nonce !== undefined) conceal.nonce = nonce;
        conceal.textContent = `:host:has(.soeditor-image-resize-overlay.is-resizing) .soeditor-wysiwyg-content > ${path.join(' > ')} { visibility: hidden; }`;
        overlay.append(conceal);
        const preview = document.createElement('img');
        preview.src = element.currentSrc || element.src;
        preview.alt = '';
        preview.draggable = false;
        preview.className = 'soeditor-image-resize-preview';
        preview.setAttribute('aria-hidden', 'true');
        overlay.append(preview);
        for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'soeditor-image-resize-handle';
            handle.setAttribute('data-resize-direction', direction);
            handle.setAttribute(
                'aria-label',
                `${ui.translate('Resize image')} ${direction.toUpperCase()}`,
            );
            let originX = 0;
            let originY = 0;
            let pointerX = 0;
            let pointerY = 0;
            let originWidth = 0;
            let originHeight = 0;
            let maxWidth = 0;
            let width = 0;
            let height = 0;
            let dragPointer: number | undefined;
            let frame: number | undefined;
            const paint = (): void => {
                frame = undefined;
                overlay.style.inlineSize = `${String(width)}px`;
                overlay.style.blockSize = `${String(height)}px`;
                overlay.style.left = `${String(originX + (direction.includes('w') ? originWidth - width : 0))}px`;
                overlay.style.top = `${String(originY + (direction.includes('n') ? originHeight - height : 0))}px`;
                overlay.setAttribute(
                    'data-dimensions',
                    `${String(width)} × ${String(height)}`,
                );
            };
            const measure = (): boolean => {
                positionResizeOverlay();
                const rectangle = element.getBoundingClientRect();
                if (rectangle.width <= 0 || rectangle.height <= 0) return false;
                originX = Number.parseFloat(overlay.style.left);
                originY = Number.parseFloat(overlay.style.top);
                originWidth = rectangle.width;
                originHeight = rectangle.height;
                const bounds = visual.getBoundingClientRect();
                const styles = view?.getComputedStyle(visual);
                const padding =
                    Number.parseFloat(styles?.paddingRight ?? '0') || 0;
                maxWidth = Math.min(
                    9999,
                    Math.max(
                        originWidth,
                        bounds.right - rectangle.left - padding,
                    ),
                );
                width = Math.round(originWidth);
                height = Math.round(originHeight);
                return true;
            };
            const resize = (
                deltaX: number,
                deltaY: number,
                preserveRatio: boolean,
            ): void => {
                const horizontal = direction.includes('e')
                    ? deltaX
                    : direction.includes('w')
                      ? -deltaX
                      : 0;
                const vertical = direction.includes('s')
                    ? deltaY
                    : direction.includes('n')
                      ? -deltaY
                      : 0;
                const locked =
                    preserveRatio ||
                    element
                        .closest('figure')
                        ?.getAttribute('data-aspect-lock') !== 'false';
                if (locked) {
                    const horizontalScale = 1 + horizontal / originWidth;
                    const verticalScale = 1 + vertical / originHeight;
                    const requested =
                        horizontal === 0
                            ? verticalScale
                            : vertical === 0
                              ? horizontalScale
                              : Math.abs(horizontalScale - 1) >=
                                  Math.abs(verticalScale - 1)
                                ? horizontalScale
                                : verticalScale;
                    const scale = Math.min(
                        maxWidth / originWidth,
                        9999 / originHeight,
                        Math.max(
                            24 / originWidth,
                            24 / originHeight,
                            requested,
                        ),
                    );
                    width = Math.round(originWidth * scale);
                    height = Math.round(originHeight * scale);
                } else {
                    width = Math.min(
                        Math.round(maxWidth),
                        Math.max(24, Math.round(originWidth + horizontal)),
                    );
                    height = Math.min(
                        9999,
                        Math.max(24, Math.round(originHeight + vertical)),
                    );
                }
            };
            const finish = (): void => {
                if (frame !== undefined) view?.cancelAnimationFrame(frame);
                frame = undefined;
                const pointer = dragPointer;
                dragPointer = undefined;
                cancelDrag = undefined;
                overlay.classList.remove('is-resizing');
                overlay.removeAttribute('data-dimensions');
                if (pointer !== undefined && handle.hasPointerCapture(pointer))
                    handle.releasePointerCapture(pointer);
            };
            const cancel = (): void => {
                if (dragPointer === undefined) return;
                finish();
                positionResizeOverlay();
            };
            const commit = (): void => {
                const changed =
                    width !== Math.round(originWidth) ||
                    height !== Math.round(originHeight);
                finish();
                if (changed && visual.isContentEditable && element.isConnected)
                    Reflect.apply(update, undefined, [{ height, width }]);
                positionResizeOverlay();
                visual.focus({ preventScroll: true });
            };
            handle.addEventListener('pointerdown', (event) => {
                if (event.button !== 0 || !visual.isContentEditable) return;
                event.preventDefault();
                event.stopPropagation();
                cancelDrag?.();
                if (!measure()) return;
                pointerX = event.clientX;
                pointerY = event.clientY;
                dragPointer = event.pointerId;
                cancelDrag = cancel;
                imageTools?.close();
                imageTools = undefined;
                handle.setPointerCapture(event.pointerId);
                overlay.classList.add('is-resizing');
                paint();
            });
            handle.addEventListener('pointermove', (event) => {
                if (dragPointer !== event.pointerId) return;
                resize(
                    event.clientX - pointerX,
                    event.clientY - pointerY,
                    event.shiftKey,
                );
                if (frame === undefined)
                    frame = view?.requestAnimationFrame(paint);
            });
            handle.addEventListener('pointerup', (event) => {
                if (dragPointer !== event.pointerId) return;
                resize(
                    event.clientX - pointerX,
                    event.clientY - pointerY,
                    event.shiftKey,
                );
                commit();
            });
            handle.addEventListener('pointercancel', cancel);
            handle.addEventListener('lostpointercapture', cancel);
            handle.addEventListener('keydown', (event) => {
                if (
                    !event.key.startsWith('Arrow') ||
                    dragPointer !== undefined ||
                    !visual.isContentEditable
                )
                    return;
                event.preventDefault();
                if (!measure()) return;
                const step = event.shiftKey ? 10 : 1;
                resize(
                    event.key === 'ArrowRight'
                        ? step
                        : event.key === 'ArrowLeft'
                          ? -step
                          : 0,
                    event.key === 'ArrowDown'
                        ? step
                        : event.key === 'ArrowUp'
                          ? -step
                          : 0,
                    event.shiftKey,
                );
                const changed =
                    width !== Math.round(originWidth) ||
                    height !== Math.round(originHeight);
                if (changed)
                    Reflect.apply(update, undefined, [{ height, width }]);
                positionResizeOverlay();
            });
            overlay.append(handle);
        }
        shadow.append(overlay);
        resizeOverlay = overlay;
        observer?.observe(visual, {
            attributes: true,
            childList: true,
            subtree: true,
        });
        resizeObserver?.observe(element);
        resizeObserver?.observe(visual);
        resizeObserver?.observe(shadow.host);
        positionResizeOverlay();
    };
    const dismissResizeOverlay = (event: PointerEvent): void => {
        if (
            resizeOverlay !== undefined &&
            !event.composedPath().includes(resizeOverlay) &&
            (imageTools === undefined ||
                !event.composedPath().includes(imageTools.element)) &&
            event.composedPath()[0] !== selectedImage
        )
            removeResizeOverlay();
    };
    const escape = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' || resizeOverlay === undefined) return;
        event.preventDefault();
        if (cancelDrag !== undefined) cancelDrag();
        else removeResizeOverlay();
        visual.focus({ preventScroll: true });
    };
    const blur = (): void => cancelDrag?.();
    const activate = (event: Pick<Event, 'target' | 'type'>): void => {
        const detail: unknown = Reflect.get(event, 'detail');
        if (typeof detail !== 'object' || detail === null) return;
        const element: unknown = Reflect.get(detail, 'element');
        const update: unknown = Reflect.get(detail, 'update');
        const remove: unknown = Reflect.get(detail, 'remove');
        if (
            !(element instanceof HTMLImageElement) ||
            !visual.contains(element) ||
            !visual.isContentEditable ||
            typeof update !== 'function' ||
            typeof remove !== 'function'
        ) {
            return;
        }
        removeResizeOverlay();
        const figure = element.closest('figure');
        const link =
            element.parentElement?.tagName === 'A'
                ? element.parentElement
                : undefined;
        const caption = figure?.querySelector(':scope > figcaption');
        const body = document.createElement('div');
        body.className = 'soeditor-classic__image-properties';
        const controls = new Map<string, HTMLInputElement>();
        const createField = (
            name: string,
            label: string,
            type: string,
            initial: string,
            container: HTMLElement,
            options: { readonly wide?: boolean; readonly hint?: string } = {},
        ): HTMLInputElement => {
            const field = document.createElement('label');
            field.className = 'soeditor-classic__image-field';
            if (options.wide === true) {
                field.classList.add('soeditor-classic__image-field--wide');
            }
            const fieldLabel = document.createElement('span');
            fieldLabel.textContent = label;
            const input = document.createElement('input');
            input.type = type;
            input.value = initial;
            input.setAttribute('aria-label', label);
            if (type === 'number') input.min = '1';
            field.append(fieldLabel, input);
            if (options.hint !== undefined) {
                const hint = document.createElement('small');
                hint.textContent = options.hint;
                field.append(hint);
            }
            controls.set(name, input);
            container.append(field);
            return input;
        };
        const createGroup = (title: string): HTMLFieldSetElement => {
            const group = document.createElement('fieldset');
            group.className = 'soeditor-classic__image-group';
            const legend = document.createElement('legend');
            legend.textContent = title;
            group.append(legend);
            return group;
        };

        const contentGroup = createGroup('Image and description');
        for (const [name, label, type, initial, hint] of [
            [
                'src',
                'Image URL',
                'url',
                element.getAttribute('src') ?? '',
                undefined,
            ],
            [
                'alt',
                'Alternative text',
                'text',
                element.getAttribute('alt') ?? '',
                'Describe the image for people who cannot see it.',
            ],
            [
                'title',
                'Image title',
                'text',
                element.getAttribute('title') ?? '',
                undefined,
            ],
            [
                'caption',
                'Visible caption',
                'text',
                caption?.textContent ?? '',
                undefined,
            ],
        ] as const) {
            createField(name, label, type, initial, contentGroup, {
                wide: name === 'src' || name === 'alt',
                ...(hint === undefined ? {} : { hint }),
            });
        }

        const layoutGroup = createGroup('Size and placement');
        const width = createField(
            'width',
            'Width',
            'number',
            element.getAttribute('width') ?? '',
            layoutGroup,
        );
        const height = createField(
            'height',
            'Height',
            'number',
            element.getAttribute('height') ?? '',
            layoutGroup,
        );
        const aspectField = document.createElement('label');
        aspectField.className = 'soeditor-classic__image-aspect';
        const aspectLocked = document.createElement('input');
        aspectLocked.type = 'checkbox';
        aspectLocked.checked =
            figure?.getAttribute('data-aspect-lock') !== 'false';
        aspectLocked.setAttribute('aria-label', 'Lock aspect ratio');
        const aspectText = document.createElement('span');
        aspectText.textContent = 'Lock aspect ratio';
        aspectField.append(aspectLocked, aspectText);
        layoutGroup.append(aspectField);

        const alignmentField = document.createElement('label');
        alignmentField.className = 'soeditor-classic__image-field';
        const alignmentCaption = document.createElement('span');
        alignmentCaption.textContent = 'Alignment';
        const alignment = document.createElement('select');
        alignment.setAttribute('aria-label', 'Alignment');
        for (const [value, label] of [
            ['', 'Default'],
            ['left', 'Left'],
            ['center', 'Center'],
            ['right', 'Right'],
            ['wide', 'Wide'],
        ] as const) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            alignment.append(option);
        }
        alignment.value = figure?.getAttribute('data-align') ?? '';
        alignmentField.append(alignmentCaption, alignment);
        layoutGroup.append(alignmentField);

        const originalWidth = Number(width.value);
        const originalHeight = Number(height.value);
        const ratio =
            originalWidth > 0 && originalHeight > 0
                ? originalWidth / originalHeight
                : undefined;
        let syncingDimensions = false;
        const syncDimension = (
            source: HTMLInputElement,
            target: HTMLInputElement,
            multiplier: number,
        ): void => {
            if (
                syncingDimensions ||
                !aspectLocked.checked ||
                ratio === undefined
            ) {
                return;
            }
            const value = Number(source.value);
            if (!Number.isFinite(value) || value <= 0) return;
            syncingDimensions = true;
            target.value = String(Math.max(1, Math.round(value * multiplier)));
            syncingDimensions = false;
        };
        width.addEventListener('input', () =>
            syncDimension(width, height, 1 / (ratio ?? 1)),
        );
        height.addEventListener('input', () =>
            syncDimension(height, width, ratio ?? 1),
        );

        const linkGroup = createGroup('Link');
        createField(
            'link',
            'Link URL',
            'url',
            link?.getAttribute('href') ?? '',
            linkGroup,
            { wide: true },
        );
        const linkTargetField = document.createElement('label');
        linkTargetField.className =
            'soeditor-classic__image-field soeditor-classic__image-field--wide';
        const linkTargetCaption = document.createElement('span');
        linkTargetCaption.textContent = 'Link target';
        const linkTarget = document.createElement('select');
        linkTarget.setAttribute('aria-label', 'Link target');
        for (const [value, label] of [
            ['', 'Same window'],
            ['_blank', 'New window or tab (_blank)'],
            ['_parent', 'Parent frame (_parent)'],
            ['_top', 'Top frame (_top)'],
        ] as const) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            linkTarget.append(option);
        }
        const currentTarget = link?.getAttribute('target') ?? '';
        if (
            currentTarget.length > 0 &&
            !Array.from(linkTarget.options).some(
                (option) => option.value === currentTarget,
            )
        ) {
            const custom = document.createElement('option');
            custom.value = currentTarget;
            custom.textContent = currentTarget;
            linkTarget.append(custom);
        }
        linkTarget.value = currentTarget;
        linkTargetField.append(linkTargetCaption, linkTarget);
        linkGroup.append(linkTargetField);

        const advanced = document.createElement('details');
        advanced.className = 'soeditor-classic__image-advanced';
        const advancedSummary = document.createElement('summary');
        advancedSummary.textContent = 'Responsive image settings';
        const advancedFields = document.createElement('div');
        advancedFields.className = 'soeditor-classic__image-advanced-fields';
        for (const [name, label, initial] of [
            [
                'responsiveClass',
                'Responsive CSS classes',
                element.getAttribute('class') ?? '',
            ],
            [
                'srcset',
                'Responsive sources',
                element.getAttribute('srcset') ?? '',
            ],
            ['sizes', 'Responsive sizes', element.getAttribute('sizes') ?? ''],
        ] as const) {
            createField(name, label, 'text', initial, advancedFields, {
                wide: true,
            });
        }
        advanced.append(advancedSummary, advancedFields);
        body.append(contentGroup, layoutGroup, linkGroup, advanced);
        const dialog = ui.dialogs.open({
            title: 'Image properties',
            content: body,
            actions: [
                {
                    label: 'Remove image',
                    run: () => {
                        dialog.close();
                        Reflect.apply(remove, undefined, []);
                    },
                },
                {
                    kind: 'primary',
                    label: 'Update image',
                    run: () => {
                        const values = Object.fromEntries(
                            [...controls].map(([name, input]) => [
                                name,
                                input.value,
                            ]),
                        );
                        Object.assign(values, {
                            alignment: alignment.value,
                            aspectLocked: aspectLocked.checked,
                            linkTarget: linkTarget.value,
                        });
                        dialog.close();
                        Reflect.apply(update, undefined, [values]);
                    },
                },
            ],
        });
        dialog.element.classList.add('soeditor-classic__image-dialog');
        controls.get('src')?.focus();
    };
    visual.addEventListener('soeditor:image-activate', activate);
    visual.addEventListener('soeditor:image-select', select);
    document.addEventListener('pointerdown', dismissResizeOverlay, true);
    view?.addEventListener('resize', schedulePosition);
    view?.addEventListener('blur', blur);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('scroll', schedulePosition, true);
    if (initialEvent !== undefined) {
        if (initialEvent.type === 'soeditor:image-activate')
            activate(initialEvent);
        else select(initialEvent);
    }
    return () => {
        visual.removeEventListener('soeditor:image-activate', activate);
        visual.removeEventListener('soeditor:image-select', select);
        document.removeEventListener('pointerdown', dismissResizeOverlay, true);
        document.defaultView?.removeEventListener('resize', schedulePosition);
        document.removeEventListener('scroll', schedulePosition, true);
        view?.removeEventListener('blur', blur);
        document.removeEventListener('keydown', escape, true);
        removeResizeOverlay();
    };
}
