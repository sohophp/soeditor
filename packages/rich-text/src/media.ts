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
type KnownImageAttribute = 'src' | 'alt' | 'width' | 'height';

/** Options accepted by the structured `media.insert` command. */
export interface MediaInsertOptions {
    readonly src: string;
    readonly alt?: string;
    readonly caption?: string;
    readonly width?: number;
    readonly height?: number;
}

/** Partial values accepted by `media.update`. */
export interface MediaUpdateOptions {
    readonly src?: string;
    readonly alt?: string;
    readonly caption?: string;
    /** `null` removes the source attribute; omission keeps it unchanged. */
    readonly width?: number | null;
    /** `null` removes the source attribute; omission keeps it unchanged. */
    readonly height?: number | null;
}

interface ParsedMedia {
    readonly caption: HtmlElement | undefined;
    readonly image: HtmlElement;
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
                matches: (node) =>
                    node.namespace === 'html' && node.tagName === 'figure',
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
    const apply = context.document.createElement('button');
    apply.type = 'button';
    apply.textContent = 'Apply media properties';
    const removeCaption = context.document.createElement('button');
    removeCaption.type = 'button';
    removeCaption.textContent = 'Remove caption';
    form.append(apply, removeCaption);
    const controls = [src, alt, caption, width, height, apply, removeCaption];
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
                alt: alt.value,
                caption: caption.value,
                height: height.value.length === 0 ? null : Number(height.value),
                src: src.value,
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
    const images = meaningful.filter((child) => isElement(child, 'img'));
    const captions = meaningful.filter((child) =>
        isElement(child, 'figcaption'),
    );
    if (
        images.length !== 1 ||
        captions.length > 1 ||
        meaningful.length !== images.length + captions.length
    ) {
        throw new Error('figure requires one image and an optional caption');
    }
    const image = images[0];
    if (image === undefined || image.children.length !== 0) {
        throw new Error('figure image must be a void element');
    }
    return { caption: captions[0], image };
}

function updateMedia(
    figure: HtmlElement,
    parsed: ParsedMedia,
    options: MediaUpdateOptions,
): HtmlElement {
    const image = {
        ...parsed.image,
        attributes: updateImageAttributes(parsed.image.attributes, options),
    };
    const caption =
        options.caption === undefined
            ? parsed.caption
            : htmlElement('figcaption', parsed.caption?.attributes ?? [], [
                  Object.freeze({ type: 'text', value: options.caption }),
              ]);
    return {
        ...figure,
        children: [image, ...(caption === undefined ? [] : [caption])],
    };
}

function updateImageAttributes(
    attributes: readonly HtmlAttribute[],
    options: MediaUpdateOptions,
): readonly HtmlAttribute[] {
    const updates = new Map<string, string | null>();
    if (options.src !== undefined) updates.set('src', options.src);
    if (options.alt !== undefined) updates.set('alt', options.alt);
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

function createMediaFragment(options: MediaInsertOptions) {
    const attributes: HtmlAttribute[] = [
        { name: 'src', value: options.src },
        { name: 'alt', value: options.alt ?? '' },
    ];
    if (options.width !== undefined) {
        attributes.push({ name: 'width', value: String(options.width) });
    }
    if (options.height !== undefined) {
        attributes.push({ name: 'height', value: String(options.height) });
    }
    const children: HtmlElement[] = [htmlElement('img', attributes, [])];
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
            htmlElement(
                'figure',
                [{ name: 'data-soeditor-media', value: 'image' }],
                children,
            ),
        ]),
        type: 'document-fragment' as const,
    });
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
        (key) => !['src', 'alt', 'caption', 'width', 'height'].includes(key),
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
        ...(caption === undefined ? {} : { caption }),
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
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
    name: KnownImageAttribute,
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
