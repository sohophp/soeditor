import { Plugin, createServiceToken, type Editor } from '@soeditor/core';
import {
    StructuredEditingPlugin,
    structuredEditingRegistryToken,
    visualEditingServiceToken,
    type EditingStructuredBlock,
    type StructuredNodeViewContext,
    type StructuredNodeViewInstance,
} from '@soeditor/engine';
import {
    serializeHtmlFragment,
    type HtmlAttribute,
    type HtmlChildNode,
    type HtmlElement,
} from '@soeditor/html';

import { RichTextArgumentError } from './features.js';

export interface CmsObjectDefinition {
    readonly element?: string;
    readonly id: string;
    readonly label: string;
    readonly properties?: readonly string[];
}

export interface CmsEmbedMetadata {
    readonly provider: string;
    readonly thumbnailUrl?: string;
    readonly title: string;
    readonly url: string;
}

export interface CmsEmbedProvider {
    resolve(url: string): PromiseLike<CmsEmbedMetadata>;
}

export const cmsEmbedProviderServiceToken =
    createServiceToken<CmsEmbedProvider>('soeditor.cms-embed-provider');

const embedType = 'soeditor.cms-embed';

/** Registers bounded CMS objects and inert provider-metadata embeds. */
export class CmsObjectsPlugin extends Plugin {
    static readonly id = 'cms-objects';
    static readonly requires = [StructuredEditingPlugin];
    #dispose: (() => void)[] = [];

    override init(): void {
        const registry = this.editor.services.get(
            structuredEditingRegistryToken,
        );
        const definitions = readDefinitions(
            this.editor.config.get<unknown>('cms.objects'),
        );
        for (const definition of definitions) {
            const type = objectType(definition.id);
            this.#dispose.push(
                registry.registerBlock({
                    behavior: 'atomic',
                    fromHtml: (node) => ({
                        attributes: node.attributes,
                        children: node.children,
                    }),
                    id: type,
                    matches: (node) =>
                        node.namespace === 'html' &&
                        node.tagName === definition.element &&
                        attribute(node.attributes, 'data-soeditor-object') ===
                            definition.id,
                    toHtml: (block): HtmlElement => ({
                        attributes: block.attributes,
                        children: block.children,
                        namespace: 'html',
                        tagName: definition.element,
                        type: 'element',
                    }),
                    type,
                }),
                registry.registerNodeView(type, (context) =>
                    createObjectNodeView(context, definition),
                ),
            );
            this.registerObjectCommands(definition, type);
        }
        this.#dispose.push(
            registry.registerBlock({
                behavior: 'atomic',
                fromHtml: (node) => ({
                    attributes: node.attributes,
                    children: node.children,
                }),
                id: embedType,
                matches: (node) =>
                    node.namespace === 'html' &&
                    node.tagName === 'figure' &&
                    attribute(node.attributes, 'data-soeditor-embed') !==
                        undefined,
                toHtml: (block): HtmlElement => ({
                    attributes: block.attributes,
                    children: block.children,
                    namespace: 'html',
                    tagName: 'figure',
                    type: 'element',
                }),
                type: embedType,
            }),
            registry.registerNodeView(embedType, createEmbedNodeView),
        );
        this.registerCommonCommands();
    }

    override destroy(): void {
        for (const dispose of this.#dispose.reverse()) dispose();
        this.#dispose = [];
    }

    private registerObjectCommands(
        definition: NormalizedObjectDefinition,
        type: string,
    ): void {
        const insertId = `cmsObject.${definition.id}.insert`;
        const updateId = `cmsObject.${definition.id}.update`;
        const removeId = `cmsObject.${definition.id}.remove`;
        this.editor.commands.register({
            id: insertId,
            label: `Insert ${definition.label}`,
            canExecute: ({ editor }) => canEdit(editor),
            execute: ({ editor }, properties = {}) => {
                const attributes = objectAttributes(
                    insertId,
                    definition,
                    properties,
                );
                editor.services
                    .get(visualEditingServiceToken)
                    .insertHtml(
                        serializeHtmlFragment(
                            fragment([
                                element(definition.element, attributes, []),
                            ]),
                        ),
                    );
            },
        });
        this.editor.commands.register({
            id: updateId,
            label: `Update ${definition.label}`,
            canExecute: ({ editor }) =>
                canEdit(editor) &&
                editor.services
                    .get(visualEditingServiceToken)
                    .isStructuredBlockSelected(type),
            execute: ({ editor }, properties = {}) => {
                const service = editor.services.get(visualEditingServiceToken);
                const block = requireBlock(
                    service.getSelectedStructuredBlock(type),
                    updateId,
                );
                const updates = new Map(
                    objectAttributes(updateId, definition, properties)
                        .filter((item) => item.name !== 'data-soeditor-object')
                        .map((item) => [item.name, item.value]),
                );
                const attributes = block.attributes
                    .filter((item) => !updates.has(item.name))
                    .concat(
                        [...updates].map(([name, value]) => ({ name, value })),
                    );
                service.setStructuredBlockAttributes(type, attributes);
            },
        });
        this.editor.commands.register({
            id: removeId,
            label: `Remove ${definition.label}`,
            canExecute: ({ editor }) =>
                canEdit(editor) &&
                editor.services
                    .get(visualEditingServiceToken)
                    .isStructuredBlockSelected(type),
            execute: ({ editor }, ...args) => {
                noArguments(removeId, args);
                const remove = editor.services.get(
                    visualEditingServiceToken,
                ).removeSelectedStructuredBlock;
                if (remove === undefined) {
                    throw new RichTextArgumentError(
                        removeId,
                        'requires structured-block removal support.',
                    );
                }
                remove(type);
            },
        });
    }

    private registerCommonCommands(): void {
        this.editor.commands.register({
            id: 'specialCharacter.insert',
            label: 'Insert special character',
            canExecute: ({ editor }) => canEdit(editor),
            execute: ({ editor }, value) => {
                if (
                    typeof value !== 'string' ||
                    value.length === 0 ||
                    Array.from(value).length > 4 ||
                    hasControl(value)
                ) {
                    throw new RichTextArgumentError(
                        'specialCharacter.insert',
                        'requires one bounded printable value.',
                    );
                }
                editor.services
                    .get(visualEditingServiceToken)
                    .insertHtml(serializeHtmlFragment(fragment([text(value)])));
            },
        });
        this.editor.commands.register({
            id: 'anchor.insert',
            label: 'Insert named anchor',
            canExecute: ({ editor }) => canEdit(editor),
            execute: ({ editor }, name) => {
                const id = safeName('anchor.insert', name);
                const service = editor.services.get(visualEditingServiceToken);
                service.insertHtml(
                    serializeHtmlFragment(
                        fragment([
                            element('a', [{ name: 'id', value: id }], []),
                        ]),
                    ),
                    { placement: 'selection-start' },
                );
            },
        });
        this.editor.commands.register({
            id: 'pageBreak.insert',
            label: 'Insert page break',
            canExecute: ({ editor }) => canEdit(editor),
            execute: ({ editor }, ...args) => {
                noArguments('pageBreak.insert', args);
                editor.services
                    .get(visualEditingServiceToken)
                    .insertHtml('<hr data-page-break="true">');
            },
        });
        this.editor.commands.register({
            id: 'placeholder.insert',
            label: 'Insert CMS placeholder',
            canExecute: ({ editor }) => canEdit(editor),
            execute: ({ editor }, name) => {
                const value = safeName('placeholder.insert', name);
                editor.services.get(visualEditingServiceToken).insertHtml(
                    serializeHtmlFragment(
                        fragment([
                            element(
                                'span',
                                [
                                    {
                                        name: 'data-soeditor-placeholder',
                                        value,
                                    },
                                ],
                                [text(`{{${value}}}`)],
                            ),
                        ]),
                    ),
                );
            },
        });
        this.editor.commands.register({
            id: 'embed.insert',
            label: 'Insert safe embed metadata',
            canExecute: ({ editor }) =>
                canEdit(editor) &&
                editor.services.has(cmsEmbedProviderServiceToken),
            execute: async ({ editor }, url) => {
                if (typeof url !== 'string' || !safeWebUrl(url)) {
                    throw new RichTextArgumentError(
                        'embed.insert',
                        'requires a safe HTTP(S) URL.',
                    );
                }
                const metadata = normalizeEmbedMetadata(
                    await editor.services
                        .get(cmsEmbedProviderServiceToken)
                        .resolve(url),
                );
                editor.services
                    .get(visualEditingServiceToken)
                    .insertHtml(serializeHtmlFragment(embedFragment(metadata)));
                return metadata;
            },
        });
    }
}

interface NormalizedObjectDefinition {
    readonly element: string;
    readonly id: string;
    readonly label: string;
    readonly properties: readonly string[];
}

function readDefinitions(
    value: unknown,
): readonly NormalizedObjectDefinition[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 64) {
        throw new TypeError(
            'cms.objects must be an array of at most 64 definitions.',
        );
    }
    const ids = new Set<string>();
    return Object.freeze(
        value.map((candidate): NormalizedObjectDefinition => {
            if (typeof candidate !== 'object' || candidate === null) {
                throw new TypeError(
                    'Each cms.objects definition must be an object.',
                );
            }
            const definition = candidate as Record<string, unknown>;
            const id = definition.id;
            const label = definition.label;
            const tagName = definition.element ?? 'div';
            const properties = definition.properties ?? [];
            if (
                typeof id !== 'string' ||
                !/^[a-z][a-z0-9-]{0,63}$/u.test(id) ||
                ids.has(id) ||
                typeof label !== 'string' ||
                label.length === 0 ||
                label.length > 128 ||
                typeof tagName !== 'string' ||
                !/^[a-z][a-z0-9-]{0,31}$/u.test(tagName) ||
                !Array.isArray(properties) ||
                properties.length > 32 ||
                !properties.every(
                    (property) =>
                        typeof property === 'string' &&
                        /^[a-z][a-z0-9-]{0,31}$/u.test(property),
                )
            ) {
                throw new TypeError(
                    'cms.objects contains an invalid definition.',
                );
            }
            ids.add(id);
            return Object.freeze({
                element: tagName,
                id,
                label,
                properties: Object.freeze([...new Set(properties)]),
            });
        }),
    );
}

function objectAttributes(
    command: string,
    definition: NormalizedObjectDefinition,
    value: unknown,
): readonly HtmlAttribute[] {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new RichTextArgumentError(
            command,
            'requires a properties object.',
        );
    }
    const entries = Object.entries(value);
    if (
        entries.some(
            ([name, property]) =>
                !definition.properties.includes(name) ||
                typeof property !== 'string' ||
                property.length > 2048 ||
                hasControl(property),
        )
    ) {
        throw new RichTextArgumentError(
            command,
            'contains an invalid property.',
        );
    }
    return Object.freeze([
        { name: 'data-soeditor-object', value: definition.id },
        ...entries.map(([name, property]) => ({
            name: `data-${name}`,
            value: String(property),
        })),
    ]);
}

function createObjectNodeView(
    context: StructuredNodeViewContext,
    definition: NormalizedObjectDefinition,
): StructuredNodeViewInstance {
    const root = context.document.createElement('div');
    root.className = 'soeditor-cms-object';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', definition.label);
    const title = context.document.createElement('strong');
    title.textContent = definition.label;
    const values = context.document.createElement('dl');
    for (const property of definition.properties) {
        const value = attribute(context.node.attributes, `data-${property}`);
        if (value === undefined) continue;
        const term = context.document.createElement('dt');
        term.textContent = property;
        const description = context.document.createElement('dd');
        description.textContent = value;
        values.append(term, description);
    }
    root.append(title, values);
    return { element: root };
}

function createEmbedNodeView(
    context: StructuredNodeViewContext,
): StructuredNodeViewInstance {
    const root = context.document.createElement('div');
    root.className = 'soeditor-cms-embed';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Embedded content metadata');
    const title = attribute(context.node.attributes, 'data-title') ?? 'Embed';
    const provider = attribute(context.node.attributes, 'data-soeditor-embed');
    root.textContent =
        provider === undefined ? title : `${title} — ${provider}`;
    return { element: root };
}

function normalizeEmbedMetadata(value: unknown): CmsEmbedMetadata {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('Embed provider returned an invalid result.');
    }
    const record = value as Record<string, unknown>;
    if (
        typeof record.provider !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/u.test(record.provider) ||
        typeof record.title !== 'string' ||
        record.title.length === 0 ||
        record.title.length > 512 ||
        typeof record.url !== 'string' ||
        !safeWebUrl(record.url) ||
        (record.thumbnailUrl !== undefined &&
            (typeof record.thumbnailUrl !== 'string' ||
                !safeWebUrl(record.thumbnailUrl)))
    ) {
        throw new TypeError('Embed provider returned unsafe metadata.');
    }
    return Object.freeze({
        provider: record.provider,
        title: record.title,
        url: record.url,
        ...(typeof record.thumbnailUrl === 'string'
            ? { thumbnailUrl: record.thumbnailUrl }
            : {}),
    });
}

function embedFragment(metadata: CmsEmbedMetadata) {
    return fragment([
        element(
            'figure',
            [
                { name: 'data-soeditor-embed', value: metadata.provider },
                { name: 'data-title', value: metadata.title },
                { name: 'data-url', value: metadata.url },
                ...(metadata.thumbnailUrl === undefined
                    ? []
                    : [
                          {
                              name: 'data-thumbnail-url',
                              value: metadata.thumbnailUrl,
                          },
                      ]),
            ],
            [
                element(
                    'a',
                    [{ name: 'href', value: metadata.url }],
                    [text(metadata.title)],
                ),
                element('figcaption', [], [text(metadata.provider)]),
            ],
        ),
    ]);
}

function canEdit(editor: Editor): boolean {
    return (
        editor.services.tryGet(visualEditingServiceToken)?.canEdit() ?? false
    );
}

function requireBlock(
    block: EditingStructuredBlock | undefined,
    command: string,
): EditingStructuredBlock {
    if (block === undefined) {
        throw new RichTextArgumentError(command, 'requires a selected object.');
    }
    return block;
}

function objectType(id: string): string {
    return `soeditor.cms-object.${id}`;
}

function safeName(command: string, value: unknown): string {
    if (
        typeof value !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/u.test(value)
    ) {
        throw new RichTextArgumentError(command, 'requires a safe name.');
    }
    return value;
}

function noArguments(command: string, args: readonly unknown[]): void {
    if (args.length !== 0) {
        throw new RichTextArgumentError(command, 'does not accept arguments.');
    }
}

function safeWebUrl(value: string): boolean {
    return (
        value.length <= 2048 &&
        !hasControl(value) &&
        /^https?:\/\/[^\s]+$/iu.test(value)
    );
}

function hasControl(value: string): boolean {
    return Array.from(value).some((character) => {
        const code = character.codePointAt(0);
        return code !== undefined && (code < 32 || code === 127);
    });
}

function attribute(
    attributes: readonly HtmlAttribute[],
    name: string,
): string | undefined {
    return attributes.find((item) => item.name === name)?.value;
}

function fragment(children: readonly HtmlChildNode[]) {
    return Object.freeze({
        children: Object.freeze([...children]),
        type: 'document-fragment' as const,
    });
}

function element(
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

function text(value: string) {
    return Object.freeze({ type: 'text' as const, value });
}
