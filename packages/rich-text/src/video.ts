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
    type HtmlElement,
} from '@soeditor/html';

import { RichTextArgumentError } from './features.js';
import { isSafeMediaPreviewUrl } from './media.js';

const videoType = 'soeditor.video';

export interface VideoOptions {
    readonly height?: number | null;
    readonly poster?: string | null;
    readonly src?: string;
    readonly title?: string | null;
    readonly width?: number | null;
}

/** Structured HTML video with an inert-by-default editable node view. */
export class VideoPlugin extends Plugin {
    static readonly id = 'video';
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
                id: videoType,
                matches: (node) =>
                    node.namespace === 'html' && node.tagName === 'video',
                toHtml: (block) => ({
                    attributes: block.attributes,
                    children: block.children,
                    namespace: 'html',
                    tagName: 'video',
                    type: 'element',
                }),
                type: videoType,
            }),
        );
        this.#dispose.push(
            registry.registerNodeView(videoType, createVideoNodeView),
        );
        this.editor.commands.register({
            id: 'video.insert',
            label: 'Insert video',
            canExecute: ({ editor }) =>
                editor.services.tryGet(visualEditingServiceToken)?.canEdit() ??
                false,
            execute: ({ editor }, candidate) => {
                const options = readVideoOptions(
                    'video.insert',
                    candidate,
                    true,
                );
                editor.services
                    .get(visualEditingServiceToken)
                    .insertHtml(serializeHtmlFragment(createVideo(options)));
            },
        });
        this.editor.commands.register({
            id: 'video.update',
            label: 'Update video',
            canExecute: ({ editor }) =>
                canEditVideo(editor.services.tryGet(visualEditingServiceToken)),
            execute: ({ editor }, candidate) => {
                const service = requireVideoService(
                    editor.services.tryGet(visualEditingServiceToken),
                    'video.update',
                );
                const block = requireVideoBlock(service, 'video.update');
                const options = readVideoOptions(
                    'video.update',
                    candidate,
                    false,
                );
                service.replaceStructuredBlockContent(videoType, {
                    attributes: updateVideoAttributes(
                        block.attributes,
                        options,
                    ),
                    children: block.children,
                });
            },
        });
        this.editor.commands.register({
            id: 'video.remove',
            label: 'Remove video',
            canExecute: ({ editor }) =>
                canEditVideo(editor.services.tryGet(visualEditingServiceToken)),
            execute: ({ editor }) => {
                const service = requireVideoService(
                    editor.services.tryGet(visualEditingServiceToken),
                    'video.remove',
                );
                if (service.removeSelectedStructuredBlock === undefined) {
                    throw new RichTextArgumentError(
                        'video.remove',
                        'requires structured-block removal support.',
                    );
                }
                service.removeSelectedStructuredBlock(videoType);
            },
        });
    }

    override destroy(): void {
        for (const dispose of this.#dispose.reverse()) dispose();
        this.#dispose = [];
    }
}

function createVideoNodeView(
    context: StructuredNodeViewContext,
): StructuredNodeViewInstance {
    const root = context.document.createElement('div');
    root.className = 'soeditor-video-widget';
    const source = attributeValue(context.node.attributes, 'src') ?? '';
    const video = context.document.createElement('video');
    video.controls = true;
    video.preload = 'metadata';
    video.title = attributeValue(context.node.attributes, 'title') ?? 'Video';
    const poster = attributeValue(context.node.attributes, 'poster');
    if (source.length > 0 && isSafeMediaPreviewUrl(source)) video.src = source;
    if (poster !== undefined && isSafeMediaPreviewUrl(poster))
        video.poster = poster;
    const width = readDimension(
        attributeValue(context.node.attributes, 'width'),
    );
    const height = readDimension(
        attributeValue(context.node.attributes, 'height'),
    );
    if (width !== undefined) video.width = width;
    if (height !== undefined) video.height = height;
    if (video.src.length === 0) {
        const placeholder = context.document.createElement('div');
        placeholder.className = 'soeditor-video-placeholder';
        placeholder.textContent = 'Video URL is empty or blocked.';
        root.append(placeholder);
    } else {
        root.append(video);
    }
    const form = context.document.createElement('div');
    form.className = 'soeditor-video-fields';
    const src = videoField(context, form, 'Video URL', source, 'url');
    const posterInput = videoField(
        context,
        form,
        'Poster URL',
        poster ?? '',
        'url',
    );
    const title = videoField(context, form, 'Title', video.title, 'text');
    const widthInput = videoField(
        context,
        form,
        'Width',
        width === undefined ? '' : String(width),
        'number',
    );
    const heightInput = videoField(
        context,
        form,
        'Height',
        height === undefined ? '' : String(height),
        'number',
    );
    const apply = context.document.createElement('button');
    apply.type = 'button';
    apply.textContent = 'Apply video properties';
    const remove = context.document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove video';
    form.append(apply, remove);
    const controls = [
        src,
        posterInput,
        title,
        widthInput,
        heightInput,
        apply,
        remove,
    ];
    const setReadonly = (readonly: boolean): void => {
        for (const control of controls) control.disabled = readonly;
    };
    setReadonly(context.readonly);
    apply.addEventListener('click', () => {
        context.actions.select({ focus: false });
        context.actions.execute('video.update', {
            height:
                heightInput.value.length === 0
                    ? null
                    : Number(heightInput.value),
            poster: posterInput.value.length === 0 ? null : posterInput.value,
            src: src.value,
            title: title.value.length === 0 ? null : title.value,
            width:
                widthInput.value.length === 0 ? null : Number(widthInput.value),
        });
    });
    remove.addEventListener('click', () => {
        context.actions.select({ focus: false });
        context.actions.execute('video.remove');
    });
    root.append(form);
    return { element: root, update: (state) => setReadonly(state.readonly) };
}

function videoField(
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

function createVideo(options: VideoOptions): {
    readonly children: readonly [HtmlElement];
    readonly type: 'document-fragment';
} {
    return {
        children: [
            {
                attributes: updateVideoAttributes([], options),
                children: [],
                namespace: 'html',
                tagName: 'video',
                type: 'element',
            },
        ],
        type: 'document-fragment',
    };
}

function readVideoOptions(
    command: string,
    candidate: unknown,
    requireSource: boolean,
): VideoOptions {
    if (
        typeof candidate !== 'object' ||
        candidate === null ||
        Array.isArray(candidate)
    )
        throw new RichTextArgumentError(
            command,
            'requires a video options object.',
        );
    const value = candidate as Record<string, unknown>;
    const src = value.src;
    if (
        (requireSource || src !== undefined) &&
        (typeof src !== 'string' || src.trim().length === 0)
    )
        throw new RichTextArgumentError(
            command,
            'requires a non-empty source URL.',
        );
    for (const key of ['poster', 'title'] as const)
        if (
            value[key] !== undefined &&
            value[key] !== null &&
            typeof value[key] !== 'string'
        )
            throw new RichTextArgumentError(
                command,
                `${key} must be a string or null.`,
            );
    for (const key of ['width', 'height'] as const)
        if (
            value[key] !== undefined &&
            value[key] !== null &&
            (!Number.isInteger(value[key]) ||
                Number(value[key]) < 1 ||
                Number(value[key]) > 10000)
        )
            throw new RichTextArgumentError(
                command,
                `${key} must be an integer from 1 to 10000 or null.`,
            );
    return {
        ...(src === undefined ? {} : { src }),
        ...(value.poster === undefined
            ? {}
            : { poster: value.poster as string | null }),
        ...(value.title === undefined
            ? {}
            : { title: value.title as string | null }),
        ...(value.width === undefined
            ? {}
            : { width: value.width as number | null }),
        ...(value.height === undefined
            ? {}
            : { height: value.height as number | null }),
    };
}

function updateVideoAttributes(
    attributes: readonly HtmlAttribute[],
    options: VideoOptions,
): readonly HtmlAttribute[] {
    const updates = new Map<string, string | null>();
    if (options.src !== undefined) updates.set('src', options.src);
    if (options.poster !== undefined) updates.set('poster', options.poster);
    if (options.title !== undefined) updates.set('title', options.title);
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
    updates.set('controls', '');
    const result = attributes.flatMap((attribute): readonly HtmlAttribute[] => {
        const value = updates.get(attribute.name);
        if (value === undefined) return [attribute];
        updates.delete(attribute.name);
        return value === null ? [] : [{ ...attribute, value }];
    });
    for (const [name, value] of updates)
        if (value !== null) result.push({ name, value });
    return result;
}

function canEditVideo(service: VisualEditingService | undefined): boolean {
    return (
        service?.canEdit() === true &&
        service.isStructuredBlockSelected(videoType)
    );
}
function requireVideoService(
    service: VisualEditingService | undefined,
    command: string,
): VisualEditingService {
    if (service === undefined)
        throw new RichTextArgumentError(
            command,
            'requires the WYSIWYG editor.',
        );
    return service;
}
function requireVideoBlock(
    service: VisualEditingService,
    command: string,
): EditingStructuredBlock {
    const block = service.getSelectedStructuredBlock(videoType);
    if (block === undefined)
        throw new RichTextArgumentError(command, 'requires a selected video.');
    return block;
}
function attributeValue(
    attributes: readonly HtmlAttribute[],
    name: string,
): string | undefined {
    return attributes.find(
        (attribute) =>
            attribute.namespace === undefined && attribute.name === name,
    )?.value;
}
function readDimension(value: string | undefined): number | undefined {
    if (value === undefined || !/^\d+$/u.test(value)) return undefined;
    const parsed = Number(value);
    return parsed >= 1 && parsed <= 10000 ? parsed : undefined;
}
