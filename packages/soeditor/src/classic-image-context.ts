import type { EditorUi } from '@soeditor/ui';

export function attachClassicImageContext(
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    const document = visual.ownerDocument;
    const shadow = visual.getRootNode();
    let resizeOverlay: HTMLElement | undefined;
    let selectedImage: HTMLImageElement | undefined;
    let selectedUpdate: ((values: unknown) => unknown) | undefined;
    const removeResizeOverlay = (): void => {
        resizeOverlay?.remove();
        resizeOverlay = undefined;
        selectedImage = undefined;
        selectedUpdate = undefined;
    };
    const positionResizeOverlay = (): void => {
        if (
            resizeOverlay === undefined ||
            selectedImage?.isConnected !== true
        ) {
            removeResizeOverlay();
            return;
        }
        const rectangle = selectedImage.getBoundingClientRect();
        resizeOverlay.style.insetInlineStart = `${String(rectangle.left)}px`;
        resizeOverlay.style.insetBlockStart = `${String(rectangle.top)}px`;
        resizeOverlay.style.inlineSize = `${String(rectangle.width)}px`;
        resizeOverlay.style.blockSize = `${String(rectangle.height)}px`;
    };
    const select = (event: Event): void => {
        const detail: unknown = Reflect.get(event, 'detail');
        if (typeof detail !== 'object' || detail === null) return;
        const element: unknown = Reflect.get(detail, 'element');
        const update: unknown = Reflect.get(detail, 'update');
        if (
            !(element instanceof HTMLImageElement) ||
            !visual.contains(element) ||
            typeof update !== 'function' ||
            !(shadow instanceof ShadowRoot)
        ) {
            return;
        }
        removeResizeOverlay();
        selectedImage = element;
        selectedUpdate = (values) => Reflect.apply(update, undefined, [values]);
        const overlay = document.createElement('div');
        overlay.className = 'soeditor-image-resize-overlay';
        const preview = document.createElement('img');
        preview.src = element.currentSrc || element.src;
        preview.alt = '';
        preview.className = 'soeditor-image-resize-preview';
        preview.setAttribute('aria-hidden', 'true');
        overlay.append(preview);
        for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'soeditor-image-resize-handle';
            handle.dataset.resizeDirection = direction;
            handle.setAttribute('aria-label', `Resize image ${direction}`);
            let originX = 0;
            let originY = 0;
            let pointerX = 0;
            let pointerY = 0;
            let originWidth = 0;
            let originHeight = 0;
            let width = 0;
            let height = 0;
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
                const rawWidth = originWidth + horizontal;
                const rawHeight = originHeight + vertical;
                const locked =
                    preserveRatio ||
                    element.closest('figure')?.dataset.aspectLock === 'true';
                if (locked) {
                    const horizontalScale = rawWidth / originWidth;
                    const verticalScale = rawHeight / originHeight;
                    const scale = Math.max(
                        24 / originWidth,
                        24 / originHeight,
                        horizontal === 0
                            ? verticalScale
                            : vertical === 0
                              ? horizontalScale
                              : Math.abs(horizontalScale - 1) >=
                                  Math.abs(verticalScale - 1)
                                ? horizontalScale
                                : verticalScale,
                    );
                    width = Math.round(originWidth * scale);
                    height = Math.round(originHeight * scale);
                } else {
                    width = Math.max(24, Math.round(rawWidth));
                    height = Math.max(24, Math.round(rawHeight));
                }
                overlay.style.inlineSize = `${String(width)}px`;
                overlay.style.blockSize = `${String(height)}px`;
                if (direction.includes('w')) {
                    overlay.style.insetInlineStart = `${String(
                        originX + originWidth - width,
                    )}px`;
                }
                if (direction.includes('n')) {
                    overlay.style.insetBlockStart = `${String(
                        originY + originHeight - height,
                    )}px`;
                }
                overlay.dataset.dimensions = `${String(width)} × ${String(height)}`;
            };
            const commit = (event: PointerEvent): void => {
                if (!handle.hasPointerCapture(event.pointerId)) return;
                handle.releasePointerCapture(event.pointerId);
                selectedUpdate?.({ height, width });
                document.defaultView?.requestAnimationFrame(
                    positionResizeOverlay,
                );
            };
            handle.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                const rectangle = element.getBoundingClientRect();
                originX = rectangle.left;
                originY = rectangle.top;
                originWidth = rectangle.width;
                originHeight = rectangle.height;
                pointerX = event.clientX;
                pointerY = event.clientY;
                width = Math.round(originWidth);
                height = Math.round(originHeight);
                handle.setPointerCapture(event.pointerId);
                overlay.classList.add('is-resizing');
            });
            handle.addEventListener('pointermove', (event) => {
                if (!handle.hasPointerCapture(event.pointerId)) return;
                resize(
                    event.clientX - pointerX,
                    event.clientY - pointerY,
                    event.shiftKey,
                );
            });
            handle.addEventListener('pointerup', (event) => {
                overlay.classList.remove('is-resizing');
                commit(event);
            });
            handle.addEventListener('pointercancel', () => {
                overlay.classList.remove('is-resizing');
                positionResizeOverlay();
            });
            handle.addEventListener('keydown', (event) => {
                if (!event.key.startsWith('Arrow')) return;
                event.preventDefault();
                const rectangle = element.getBoundingClientRect();
                originX = rectangle.left;
                originY = rectangle.top;
                originWidth = rectangle.width;
                originHeight = rectangle.height;
                const step = event.shiftKey ? 10 : 1;
                const deltaX =
                    event.key === 'ArrowRight'
                        ? step
                        : event.key === 'ArrowLeft'
                          ? -step
                          : 0;
                const deltaY =
                    event.key === 'ArrowDown'
                        ? step
                        : event.key === 'ArrowUp'
                          ? -step
                          : 0;
                resize(deltaX, deltaY, event.shiftKey);
                selectedUpdate?.({ height, width });
                document.defaultView?.requestAnimationFrame(
                    positionResizeOverlay,
                );
            });
            overlay.append(handle);
        }
        shadow.append(overlay);
        resizeOverlay = overlay;
        positionResizeOverlay();
    };
    const dismissResizeOverlay = (event: PointerEvent): void => {
        if (
            resizeOverlay !== undefined &&
            !event.composedPath().includes(resizeOverlay) &&
            event.composedPath()[0] !== selectedImage
        ) {
            removeResizeOverlay();
        }
    };
    const activate = (event: Event): void => {
        const detail: unknown = Reflect.get(event, 'detail');
        if (typeof detail !== 'object' || detail === null) return;
        const element: unknown = Reflect.get(detail, 'element');
        const update: unknown = Reflect.get(detail, 'update');
        const remove: unknown = Reflect.get(detail, 'remove');
        if (
            !(element instanceof HTMLImageElement) ||
            !visual.contains(element) ||
            typeof update !== 'function' ||
            typeof remove !== 'function'
        ) {
            return;
        }
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
            figure?.getAttribute('data-aspect-lock') === 'true';
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
    document.defaultView?.addEventListener('resize', positionResizeOverlay);
    document.addEventListener('scroll', positionResizeOverlay, true);
    return () => {
        visual.removeEventListener('soeditor:image-activate', activate);
        visual.removeEventListener('soeditor:image-select', select);
        document.removeEventListener('pointerdown', dismissResizeOverlay, true);
        document.defaultView?.removeEventListener(
            'resize',
            positionResizeOverlay,
        );
        document.removeEventListener('scroll', positionResizeOverlay, true);
        removeResizeOverlay();
    };
}
