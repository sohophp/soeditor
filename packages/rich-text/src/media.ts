import { Plugin } from '@soeditor/core';
import {
    StructuredEditingPlugin,
    structuredEditingRegistryToken,
    visualEditingServiceToken,
    type EditingStructuredBlock,
    type StructuredNodeViewContext,
    type StructuredNodeViewInstance,
    type VisualEditingService,
} from '@soeditor/engine';
import {
    serializeHtmlFragment,
    type HtmlAttribute,
    type HtmlChildNode,
    type HtmlElement,
} from '@soeditor/html';

import { RichTextArgumentError } from './features.js';

const mediaType = 'soeditor.media';
export type MediaAlignment = 'center' | 'left' | 'right' | 'wide';

/** Options accepted by the structured `media.insert` command. */
export interface MediaInsertOptions {
    readonly alignment?: MediaAlignment;
    readonly src: string;
    readonly alt?: string;
    readonly aspectLocked?: boolean;
    readonly caption?: string;
    readonly width?: number;
    readonly height?: number;
    readonly link?: string;
    readonly responsiveClass?: string;
    readonly title?: string;
}

/** Partial values accepted by `media.update`. */
export interface MediaUpdateOptions {
    readonly alignment?: MediaAlignment | null;
    readonly src?: string;
    readonly alt?: string;
    readonly aspectLocked?: boolean;
    readonly caption?: string;
    /** `null` removes the source attribute; omission keeps it unchanged. */
    readonly width?: number | null;
    /** `null` removes the source attribute; omission keeps it unchanged. */
    readonly height?: number | null;
    readonly link?: string | null;
    readonly responsiveClass?: string | null;
    readonly title?: string | null;
}

interface ParsedMedia {
    readonly caption: HtmlElement | undefined;
    readonly image: HtmlElement;
    readonly link: HtmlElement | undefined;
}

/** Structured figure/image feature using the public node-view runtime. */
export class MediaPlugin extends Plugin {
    static readonly id = 'media';
    static readonly requires = [StructuredEditingPlugin];
    #dispose: (() => void)[] = [];

    override init(): void {
        const registry = this.editor.services.get(
            structuredEditingRegistryToken,
        );
        this.#dispose.push(
            registry.registerBlock({
                behavior: 'atomic',
                fromHtml: (node) => ({
                    attributes: node.attributes,
                    children: node.children,
                }),
                id: mediaType,
                matches: isMediaFigure,
                toHtml: (block): HtmlElement => ({
                    attributes: block.attributes,
                    children: block.children,
                    namespace: 'html',
                    tagName: 'figure',
                    type: 'element',
                }),
                type: mediaType,
            }),
        );
        this.#dispose.push(
            registry.registerNodeView(mediaType, createMediaNodeView),
        );
        this.editor.commands.register({
            id: 'media.insert',
            label: 'Insert media figure',
            canExecute: ({ editor }) =>
                editor.services.tryGet(visualEditingServiceToken)?.canEdit() ??
                false,
            execute: ({ editor }, candidate) => {
                const options = readMediaOptions(
                    'media.insert',
                    candidate,
                    true,
                );
                editor.services
                    .get(visualEditingServiceToken)
                    .insertHtml(
                        serializeHtmlFragment(createMediaFragment(options)),
                    );
            },
        });
        this.editor.commands.register({
            id: 'media.update',
            label: 'Update media figure',
            canExecute: ({ editor }) =>
                canEditMedia(editor.services.tryGet(visualEditingServiceToken)),
            execute: ({ editor }, candidate) => {
                const options = readMediaOptions(
                    'media.update',
                    candidate,
                    false,
                );
                const service = requireMediaService(
                    editor.services.tryGet(visualEditingServiceToken),
                    'media.update',
                );
                const block = requireMediaBlock(service, 'media.update');
                const figure = mediaElement(block);
                const parsed = parseMedia(figure);
                const next = updateMedia(figure, parsed, options);
                service.replaceStructuredBlockContent(mediaType, {
                    attributes: next.attributes,
                    children: next.children,
                });
            },
        });
        this.editor.commands.register({
            id: 'media.caption.remove',
            label: 'Remove media caption',
            canExecute: ({ editor }) =>
                canEditMedia(editor.services.tryGet(visualEditingServiceToken)),
            execute: ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new RichTextArgumentError(
                        'media.caption.remove',
                        'does not accept arguments.',
                    );
                }
                const service = requireMediaService(
                    editor.services.tryGet(visualEditingServiceToken),
                    'media.caption.remove',
                );
                const block = requireMediaBlock(
                    service,
                    'media.caption.remove',
                );
                const figure = mediaElement(block);
                parseMedia(figure);
                service.replaceStructuredBlockContent(mediaType, {
                    attributes: figure.attributes,
                    children: figure.children.filter(
                        (child) => !isElement(child, 'figcaption'),
                    ),
                });
            },
        });
        this.editor.commands.register({
            id: 'media.remove',
            label: 'Remove media figure',
            canExecute: ({ editor }) =>
                canEditMedia(editor.services.tryGet(visualEditingServiceToken)),
            execute: ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new RichTextArgumentError(
                        'media.remove',
                        'does not accept arguments.',
                    );
                }
                const service = requireMediaService(
                    editor.services.tryGet(visualEditingServiceToken),
                    'media.remove',
                );
                if (service.removeSelectedStructuredBlock === undefined) {
                    throw new RichTextArgumentError(
                        'media.remove',
                        'requires structured-block removal support.',
                    );
                }
                service.removeSelectedStructuredBlock(mediaType);
            },
        });
    }

    override destroy(): void {
        for (const dispose of this.#dispose.reverse()) {
            dispose();
        }
        this.#dispose = [];
    }
}

/** Returns whether the controlled node view may load a media URL. */
export function isSafeMediaPreviewUrl(source: string): boolean {
    const value = source.trim();
    if (value.length === 0 || hasControlCharacter(value)) {
        return false;
    }
    if (/^data:/iu.test(value)) {
        return /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/iu.test(value);
    }
    if (/^[a-z][a-z\d+.-]*:/iu.test(value)) {
        return /^(?:https?|blob):/iu.test(value);
    }
    return true;
}

function createMediaNodeView(
    context: StructuredNodeViewContext,
): StructuredNodeViewInstance {
    const ListenerController =
        context.document.defaultView?.AbortController ?? AbortController;
    const listeners = new ListenerController();
    const root = context.document.createElement('div');
    root.className = 'soeditor-media-widget';
    let parsed: ParsedMedia;
    try {
        parsed = parseMedia(mediaElement(context.node));
    } catch (error: unknown) {
        root.setAttribute('role', 'note');
        root.textContent =
            error instanceof Error
                ? `Unsupported figure preserved: ${error.message}`
                : 'Unsupported figure preserved.';
        return { element: root };
    }

    const preview = context.document.createElement('figure');
    preview.className = 'soeditor-media-preview';
    const source = attributeValue(parsed.image.attributes, 'src') ?? '';
    if (isSafeMediaPreviewUrl(source)) {
        const image = context.document.createElement('img');
        image.src = source;
        image.alt = attributeValue(parsed.image.attributes, 'alt') ?? '';
        image.title = attributeValue(parsed.image.attributes, 'title') ?? '';
        image.loading = 'lazy';
        image.draggable = false;
        const width = positiveDimension(
            attributeValue(parsed.image.attributes, 'width'),
        );
        const height = positiveDimension(
            attributeValue(parsed.image.attributes, 'height'),
        );
        if (width !== undefined) {
            image.width = width;
        }
        if (height !== undefined) {
            image.height = height;
        }
        preview.append(image);
    } else {
        const blocked = context.document.createElement('div');
        blocked.className = 'soeditor-media-blocked';
        blocked.setAttribute('role', 'note');
        blocked.textContent = 'Media preview blocked for this URL.';
        preview.append(blocked);
    }
    if (parsed.caption !== undefined) {
        const caption = context.document.createElement('figcaption');
        caption.textContent = plainText(parsed.caption.children);
        preview.append(caption);
    }

    const form = context.document.createElement('div');
    form.className = 'soeditor-media-fields';
    form.setAttribute('role', 'group');
    form.setAttribute('aria-label', 'Media properties');
    const src = field(context, form, 'Media URL', source, 'url');
    const alt = field(
        context,
        form,
        'Alternative text',
        attributeValue(parsed.image.attributes, 'alt') ?? '',
        'text',
    );
    const title = field(
        context,
        form,
        'Title',
        attributeValue(parsed.image.attributes, 'title') ?? '',
        'text',
    );
    const caption = field(
        context,
        form,
        'Caption',
        parsed.caption === undefined ? '' : plainText(parsed.caption.children),
        'text',
    );
    const width = field(
        context,
        form,
        'Width',
        attributeValue(parsed.image.attributes, 'width') ?? '',
        'number',
    );
    const height = field(
        context,
        form,
        'Height',
        attributeValue(parsed.image.attributes, 'height') ?? '',
        'number',
    );
    const alignment = field(
        context,
        form,
        'Alignment',
        attributeValue(mediaElement(context.node).attributes, 'data-align') ??
            '',
        'text',
    );
    const responsiveClass = field(
        context,
        form,
        'Responsive class',
        attributeValue(parsed.image.attributes, 'class') ?? '',
        'text',
    );
    const link = field(
        context,
        form,
        'Link URL',
        parsed.link === undefined
            ? ''
            : (attributeValue(parsed.link.attributes, 'href') ?? ''),
        'url',
    );
    const aspectLocked = context.document.createElement('input');
    aspectLocked.type = 'checkbox';
    aspectLocked.checked =
        attributeValue(
            mediaElement(context.node).attributes,
            'data-aspect-lock',
        ) === 'true';
    const aspectLabel = context.document.createElement('label');
    aspectLabel.textContent = 'Lock aspect ratio';
    aspectLabel.append(aspectLocked);
    form.append(aspectLabel);
    const apply = context.document.createElement('button');
    apply.type = 'button';
    apply.textContent = 'Apply media properties';
    const removeCaption = context.document.createElement('button');
    removeCaption.type = 'button';
    removeCaption.textContent = 'Remove caption';
    const removeMedia = context.document.createElement('button');
    removeMedia.type = 'button';
    removeMedia.textContent = 'Remove image';
    form.append(apply, removeCaption, removeMedia);
    const controls = [
        src,
        alt,
        title,
        caption,
        width,
        height,
        alignment,
        responsiveClass,
        link,
        aspectLocked,
        apply,
        removeCaption,
        removeMedia,
    ];
    const setReadonly = (readonly: boolean): void => {
        for (const control of controls) {
            control.disabled = readonly;
        }
    };
    setReadonly(context.readonly);
    apply.addEventListener(
        'click',
        () => {
            context.actions.select({ focus: false });
            context.actions.execute('media.update', {
                alignment:
                    alignment.value.length === 0 ? null : alignment.value,
                alt: alt.value,
                aspectLocked: aspectLocked.checked,
                caption: caption.value,
                height: height.value.length === 0 ? null : Number(height.value),
                link: link.value.length === 0 ? null : link.value,
                responsiveClass:
                    responsiveClass.value.length === 0
                        ? null
                        : responsiveClass.value,
                src: src.value,
                title: title.value.length === 0 ? null : title.value,
                width: width.value.length === 0 ? null : Number(width.value),
            });
        },
        { signal: listeners.signal },
    );
    removeCaption.addEventListener(
        'click',
        () => {
            context.actions.select({ focus: false });
            context.actions.execute('media.caption.remove');
        },
        { signal: listeners.signal },
    );
    removeMedia.addEventListener(
        'click',
        () => {
            context.actions.select({ focus: false });
            context.actions.execute('media.remove');
        },
        { signal: listeners.signal },
    );
    root.append(preview, form);
    return {
        destroy: () => listeners.abort(),
        element: root,
        update: (state) => setReadonly(state.readonly),
    };
}

function field(
    context: StructuredNodeViewContext,
    container: HTMLElement,
    labelText: string,
    value: string,
    type: 'number' | 'text' | 'url',
): HTMLInputElement {
    const label = context.document.createElement('label');
    label.textContent = labelText;
    const input = context.document.createElement('input');
    input.type = type;
    input.value = value;
    if (type === 'number') {
        input.min = '1';
        input.max = '10000';
    }
    label.append(input);
    container.append(label);
    return input;
}

function parseMedia(figure: HtmlElement): ParsedMedia {
    const meaningful = figure.children.filter(
        (child) => !isWhitespaceText(child),
    );
    const directImages = meaningful.filter((child) => isElement(child, 'img'));
    const links = meaningful.filter((child) => isElement(child, 'a'));
    const captions = meaningful.filter((child) =>
        isElement(child, 'figcaption'),
    );
    if (
        directImages.length + links.length !== 1 ||
        captions.length > 1 ||
        meaningful.length !==
            directImages.length + links.length + captions.length
    ) {
        throw new Error('figure requires one image and an optional caption');
    }
    const link = links[0];
    const linkedChildren = link?.children.filter(
        (child) => !isWhitespaceText(child),
    );
    const linkedImage = linkedChildren?.[0];
    const image =
        directImages[0] ??
        (linkedChildren?.length === 1 &&
        linkedImage !== undefined &&
        isElement(linkedImage, 'img')
            ? linkedImage
            : undefined);
    if (image === undefined || image.children.length !== 0) {
        throw new Error('figure image must be a void element');
    }
    return { caption: captions[0], image, link };
}

function isMediaFigure(node: HtmlElement): boolean {
    if (node.namespace !== 'html' || node.tagName !== 'figure') return false;
    try {
        parseMedia(node);
        return true;
    } catch {
        return false;
    }
}

function updateMedia(
    figure: HtmlElement,
    parsed: ParsedMedia,
    options: MediaUpdateOptions,
): HtmlElement {
    const resolved = resolveAspectDimensions(parsed.image, options);
    const image = {
        ...parsed.image,
        attributes: updateImageAttributes(parsed.image.attributes, resolved),
    };
    const caption =
        resolved.caption === undefined
            ? parsed.caption
            : htmlElement('figcaption', parsed.caption?.attributes ?? [], [
                  Object.freeze({ type: 'text', value: resolved.caption }),
              ]);
    const linkedImage = updateMediaLink(parsed.link, image, resolved.link);
    return {
        ...figure,
        attributes: updateFigureAttributes(figure.attributes, resolved),
        children: [linkedImage, ...(caption === undefined ? [] : [caption])],
    };
}

function resolveAspectDimensions(
    image: HtmlElement,
    options: MediaUpdateOptions,
): MediaUpdateOptions {
    if (options.aspectLocked !== true) return options;
    const currentWidth = positiveDimension(
        attributeValue(image.attributes, 'width'),
    );
    const currentHeight = positiveDimension(
        attributeValue(image.attributes, 'height'),
    );
    if (
        currentWidth === undefined ||
        currentHeight === undefined ||
        (options.width !== undefined && options.height !== undefined)
    ) {
        return options;
    }
    if (typeof options.width === 'number') {
        return {
            ...options,
            height: Math.max(
                1,
                Math.round((options.width * currentHeight) / currentWidth),
            ),
        };
    }
    if (typeof options.height === 'number') {
        return {
            ...options,
            width: Math.max(
                1,
                Math.round((options.height * currentWidth) / currentHeight),
            ),
        };
    }
    return options;
}

function updateImageAttributes(
    attributes: readonly HtmlAttribute[],
    options: MediaUpdateOptions,
): readonly HtmlAttribute[] {
    const updates = new Map<string, string | null>();
    if (options.src !== undefined) updates.set('src', options.src);
    if (options.alt !== undefined) updates.set('alt', options.alt);
    if (options.title !== undefined) updates.set('title', options.title);
    if (options.responsiveClass !== undefined) {
        updates.set('class', options.responsiveClass);
    }
    if (options.width !== undefined)
        updates.set(
            'width',
            options.width === null ? null : String(options.width),
        );
    if (options.height !== undefined)
        updates.set(
            'height',
            options.height === null ? null : String(options.height),
        );
    const result = attributes.flatMap((attribute): readonly HtmlAttribute[] => {
        const value = updates.get(attribute.name);
        if (value === undefined) {
            return [attribute];
        }
        updates.delete(attribute.name);
        return value === null ? [] : [{ ...attribute, value }];
    });
    for (const [name, value] of updates) {
        if (value !== null) {
            result.push({ name, value });
        }
    }
    return result;
}

function updateMediaLink(
    link: HtmlElement | undefined,
    image: HtmlElement,
    value: string | null | undefined,
): HtmlElement {
    if (value === null) return image;
    if (value === undefined) {
        return link === undefined ? image : { ...link, children: [image] };
    }
    const attributes = updateAttributes(link?.attributes ?? [], {
        href: value,
    });
    return htmlElement('a', attributes, [image]);
}

function updateFigureAttributes(
    attributes: readonly HtmlAttribute[],
    options: MediaUpdateOptions,
): readonly HtmlAttribute[] {
    return updateAttributes(attributes, {
        ...(options.alignment === undefined
            ? {}
            : { 'data-align': options.alignment }),
        ...(options.aspectLocked === undefined
            ? {}
            : { 'data-aspect-lock': options.aspectLocked ? 'true' : null }),
    });
}

function updateAttributes(
    attributes: readonly HtmlAttribute[],
    values: Readonly<Record<string, string | null>>,
): readonly HtmlAttribute[] {
    const updates = new Map(Object.entries(values));
    const result = attributes.flatMap((attribute): readonly HtmlAttribute[] => {
        if (!updates.has(attribute.name)) return [attribute];
        const value = updates.get(attribute.name);
        updates.delete(attribute.name);
        return value === null || value === undefined
            ? []
            : [{ ...attribute, value }];
    });
    for (const [name, value] of updates) {
        if (value !== null) result.push({ name, value });
    }
    return result;
}

function createMediaFragment(options: MediaInsertOptions) {
    const attributes: HtmlAttribute[] = [
        { name: 'src', value: options.src },
        { name: 'alt', value: options.alt ?? '' },
    ];
    if (options.title !== undefined) {
        attributes.push({ name: 'title', value: options.title });
    }
    if (options.responsiveClass !== undefined) {
        attributes.push({ name: 'class', value: options.responsiveClass });
    }
    if (options.width !== undefined) {
        attributes.push({ name: 'width', value: String(options.width) });
    }
    if (options.height !== undefined) {
        attributes.push({ name: 'height', value: String(options.height) });
    }
    const image = htmlElement('img', attributes, []);
    const children: HtmlElement[] = [
        options.link === undefined
            ? image
            : htmlElement(
                  'a',
                  [{ name: 'href', value: options.link }],
                  [image],
              ),
    ];
    if (options.caption !== undefined) {
        children.push(
            htmlElement(
                'figcaption',
                [],
                [Object.freeze({ type: 'text', value: options.caption })],
            ),
        );
    }
    return Object.freeze({
        children: Object.freeze([
            htmlElement('figure', createFigureAttributes(options), children),
        ]),
        type: 'document-fragment' as const,
    });
}

function createFigureAttributes(
    options: MediaInsertOptions,
): readonly HtmlAttribute[] {
    return [
        { name: 'data-soeditor-media', value: 'image' },
        ...(options.alignment === undefined
            ? []
            : [{ name: 'data-align', value: options.alignment }]),
        ...(options.aspectLocked === true
            ? [{ name: 'data-aspect-lock', value: 'true' }]
            : []),
    ];
}

function readMediaOptions(
    command: string,
    candidate: unknown,
    requireSource: true,
): MediaInsertOptions;
function readMediaOptions(
    command: string,
    candidate: unknown,
    requireSource: false,
): MediaUpdateOptions;
function readMediaOptions(
    command: string,
    candidate: unknown,
    requireSource: boolean,
): MediaInsertOptions | MediaUpdateOptions {
    if (
        typeof candidate !== 'object' ||
        candidate === null ||
        Array.isArray(candidate)
    ) {
        throw new RichTextArgumentError(command, 'requires an options object.');
    }
    const value = candidate as Record<string, unknown>;
    const unknown = Object.keys(value).find(
        (key) =>
            ![
                'alignment',
                'alt',
                'aspectLocked',
                'caption',
                'height',
                'link',
                'responsiveClass',
                'src',
                'title',
                'width',
            ].includes(key),
    );
    if (unknown !== undefined) {
        throw new RichTextArgumentError(
            command,
            `does not support option "${unknown}".`,
        );
    }
    const src = optionalString(value.src);
    if (requireSource && (src === undefined || src.length === 0)) {
        throw new RichTextArgumentError(command, 'requires a non-empty src.');
    }
    if (src !== undefined && src.length === 0) {
        throw new RichTextArgumentError(
            command,
            'does not accept an empty src.',
        );
    }
    const alt = optionalString(value.alt);
    const caption = optionalString(value.caption);
    const title = optionalNullableString(
        value.title,
        !requireSource,
        command,
        'title',
    );
    const link = optionalNullableString(
        value.link,
        !requireSource,
        command,
        'link',
    );
    if (typeof link === 'string' && !isSafeMediaLinkUrl(link)) {
        throw new RichTextArgumentError(command, 'requires a safe link URL.');
    }
    const responsiveClass = optionalNullableString(
        value.responsiveClass,
        !requireSource,
        command,
        'responsiveClass',
    );
    if (
        typeof responsiveClass === 'string' &&
        !/^[a-z][a-z0-9_-]*(?:\s+[a-z][a-z0-9_-]*){0,7}$/iu.test(
            responsiveClass,
        )
    ) {
        throw new RichTextArgumentError(
            command,
            'requires responsiveClass to contain at most eight safe class tokens.',
        );
    }
    const alignment = readAlignment(value.alignment, !requireSource, command);
    const aspectLocked = optionalBoolean(
        value.aspectLocked,
        command,
        'aspectLocked',
    );
    const width = optionalDimension(
        value.width,
        command,
        'width',
        !requireSource,
    );
    const height = optionalDimension(
        value.height,
        command,
        'height',
        !requireSource,
    );
    return {
        ...(src === undefined ? {} : { src }),
        ...(alt === undefined ? {} : { alt }),
        ...(alignment === undefined ? {} : { alignment }),
        ...(aspectLocked === undefined ? {} : { aspectLocked }),
        ...(caption === undefined ? {} : { caption }),
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
        ...(link === undefined ? {} : { link }),
        ...(responsiveClass === undefined ? {} : { responsiveClass }),
        ...(title === undefined ? {} : { title }),
    };
}

function canEditMedia(service: VisualEditingService | undefined): boolean {
    return (
        service?.canEdit() === true &&
        service.isStructuredBlockSelected(mediaType)
    );
}

function requireMediaService(
    service: VisualEditingService | undefined,
    command: string,
): VisualEditingService {
    if (service === undefined) {
        throw new RichTextArgumentError(command, 'requires the visual editor.');
    }
    return service;
}

function requireMediaBlock(
    service: VisualEditingService,
    command: string,
): EditingStructuredBlock {
    const block = service.getSelectedStructuredBlock(mediaType);
    if (block === undefined) {
        throw new RichTextArgumentError(command, 'requires a selected figure.');
    }
    return block;
}

function mediaElement(block: EditingStructuredBlock): HtmlElement {
    return {
        attributes: block.attributes,
        children: block.children,
        namespace: 'html',
        tagName: 'figure',
        type: 'element',
    };
}

function optionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function optionalNullableString(
    value: unknown,
    allowNull: boolean,
    command: string,
    name: string,
): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null && allowNull) return null;
    if (typeof value !== 'string' || value.length > 2048) {
        throw new RichTextArgumentError(
            command,
            `requires ${name} to be a bounded string.`,
        );
    }
    return value;
}

function readAlignment(
    value: unknown,
    allowNull: boolean,
    command: string,
): MediaAlignment | null | undefined {
    if (value === undefined) return undefined;
    if (value === null && allowNull) return null;
    if (
        value === 'center' ||
        value === 'left' ||
        value === 'right' ||
        value === 'wide'
    ) {
        return value;
    }
    throw new RichTextArgumentError(
        command,
        'requires alignment to be left, center, right, or wide.',
    );
}

function optionalBoolean(
    value: unknown,
    command: string,
    name: string,
): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
        throw new RichTextArgumentError(
            command,
            `requires ${name} to be boolean.`,
        );
    }
    return value;
}

function isSafeMediaLinkUrl(value: string): boolean {
    if (value.length === 0 || hasControlCharacter(value)) return false;
    if (!/^[a-z][a-z\d+.-]*:/iu.test(value)) return true;
    return /^(?:https?|mailto|tel):/iu.test(value);
}

function optionalDimension(
    value: unknown,
    command: string,
    name: string,
    allowNull: boolean,
): number | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null && allowNull) {
        return null;
    }
    if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 10000
    ) {
        throw new RichTextArgumentError(
            command,
            `requires ${name} from 1 to 10000.`,
        );
    }
    return value;
}

function optionalInputDimension(value: string): number | undefined {
    if (value.length === 0) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10000
        ? parsed
        : undefined;
}

function positiveDimension(value: string | undefined): number | undefined {
    return value === undefined ? undefined : optionalInputDimension(value);
}

function attributeValue(
    attributes: readonly HtmlAttribute[],
    name: string,
): string | undefined {
    return attributes.find((attribute) => attribute.name === name)?.value;
}

function hasControlCharacter(value: string): boolean {
    return Array.from(value).some((character) => {
        const code = character.codePointAt(0);
        return code !== undefined && (code < 32 || code === 127);
    });
}

function htmlElement(
    tagName: string,
    attributes: readonly HtmlAttribute[],
    children: readonly HtmlChildNode[],
): HtmlElement {
    return Object.freeze({
        attributes: Object.freeze([...attributes]),
        children: Object.freeze([...children]),
        namespace: 'html',
        tagName,
        type: 'element',
    });
}

function isElement<TagName extends string>(
    node: HtmlChildNode,
    tagName: TagName,
): node is HtmlElement & { readonly tagName: TagName } {
    return (
        node.type === 'element' &&
        node.namespace === 'html' &&
        node.tagName === tagName
    );
}

function isWhitespaceText(node: HtmlChildNode): boolean {
    return node.type === 'text' && node.value.trim().length === 0;
}

function plainText(nodes: readonly HtmlChildNode[]): string {
    return nodes
        .map((node) =>
            node.type === 'text'
                ? node.value
                : node.type === 'element'
                  ? plainText(node.children)
                  : '',
        )
        .join('');
}
