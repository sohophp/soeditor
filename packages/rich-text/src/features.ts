import {
    Plugin,
    createServiceToken,
    type CommandContext,
} from '@soeditor/core';
import {
    StructuredEditingPlugin,
    visualEditingServiceToken,
    type VisualBlockTag,
    type VisualEditingService,
    type VisualInlineStyle,
    type VisualLinkAttributes,
    type VisualListProperties,
    type VisualTextMark,
} from '@soeditor/engine';
import {
    serializeHtmlFragment,
    type HtmlAttribute,
    type HtmlChildNode,
    type HtmlElement,
} from '@soeditor/html';

import { nestedEditingBridgeToken } from './nested-editing.js';

/** Reports an invalid rich-text command argument without mutating the editor. */
export class RichTextArgumentError extends TypeError {
    constructor(commandId: string, message: string) {
        super(`Command "${commandId}" ${message}`);
        this.name = 'RichTextArgumentError';
    }
}

abstract class FeaturePlugin extends Plugin {
    static readonly requires = [StructuredEditingPlugin];

    protected register(
        id: string,
        execute: (
            service: VisualEditingService,
            args: readonly unknown[],
        ) => void,
        isActive?: (service: VisualEditingService) => boolean,
        label?: string,
    ): void {
        this.editor.commands.register({
            id,
            ...(label === undefined ? {} : { label }),
            canExecute: ({ editor }) =>
                resolveFeatureService(editor, id)?.canEdit() ?? false,
            execute: (context, ...args) =>
                execute(requireFeatureService(context, id), args),
            ...(isActive === undefined
                ? {}
                : {
                      isActive: ({ editor }: CommandContext) => {
                          const service = resolveFeatureService(editor, id);
                          return service === undefined
                              ? false
                              : isActive(service);
                      },
                  }),
        });
    }
}

/** Registers the paragraph block command. */
export class ParagraphPlugin extends FeaturePlugin {
    static readonly id = 'paragraph';

    override init(): void {
        this.register(
            'paragraph.set',
            (service, args) => {
                assertNoArguments('paragraph.set', args);
                service.setBlock('p');
            },
            (service) => service.isBlockActive('p'),
            'Set paragraph',
        );
    }
}

/** Registers the level-validated heading command. */
export class HeadingPlugin extends FeaturePlugin {
    static readonly id = 'heading';

    override init(): void {
        this.register('paragraph.heading', (service, args) => {
            const level = oneArgument('paragraph.heading', args);
            if (
                !Number.isInteger(level) ||
                Number(level) < 1 ||
                Number(level) > 6
            ) {
                throw new RichTextArgumentError(
                    'paragraph.heading',
                    'requires an integer heading level from 1 to 6.',
                );
            }
            service.setBlock(`h${String(level)}` as VisualBlockTag);
        });
    }
}

abstract class MarkPlugin extends FeaturePlugin {
    protected registerMark(id: string, mark: VisualTextMark): void {
        this.register(
            id,
            (service, args) => {
                assertNoArguments(id, args);
                service.toggleMark(mark);
            },
            (service) => service.isMarkActive(mark),
            markLabel(mark),
        );
    }
}

/** Registers semantic strong formatting. */
export class BoldPlugin extends MarkPlugin {
    static readonly id = 'bold';
    override init(): void {
        this.registerMark('format.bold', 'strong');
    }
}

/** Registers semantic emphasis formatting. */
export class ItalicPlugin extends MarkPlugin {
    static readonly id = 'italic';
    override init(): void {
        this.registerMark('format.italic', 'em');
    }
}

/** Registers underline formatting. */
export class UnderlinePlugin extends MarkPlugin {
    static readonly id = 'underline';
    override init(): void {
        this.registerMark('format.underline', 'u');
    }
}

/** Registers strikethrough formatting. */
export class StrikePlugin extends MarkPlugin {
    static readonly id = 'strike';
    override init(): void {
        this.registerMark('format.strike', 's');
    }
}

/** Registers inline-code formatting. */
export class InlineCodePlugin extends MarkPlugin {
    static readonly id = 'inline-code';
    override init(): void {
        this.registerMark('format.inlineCode', 'code');
    }
}

/** Registers semantic superscript formatting. */
export class SuperscriptPlugin extends MarkPlugin {
    static readonly id = 'superscript';
    override init(): void {
        this.registerMark('format.superscript', 'sup');
    }
}

/** Registers semantic subscript formatting. */
export class SubscriptPlugin extends MarkPlugin {
    static readonly id = 'subscript';
    override init(): void {
        this.registerMark('format.subscript', 'sub');
    }
}

/** Removes inline presentation marks while retaining links. */
export class RemoveFormatPlugin extends FeaturePlugin {
    static readonly id = 'remove-format';
    override init(): void {
        this.register('format.remove', (service, args) => {
            assertNoArguments('format.remove', args);
            requireExtendedCapability(service.removeFormat, 'format.remove')();
        });
    }
}

/** Inserts a semantic horizontal rule at the current selection. */
export class HorizontalRulePlugin extends FeaturePlugin {
    static readonly id = 'horizontal-rule';
    override init(): void {
        this.register('horizontalRule.insert', (service, args) => {
            assertNoArguments('horizontalRule.insert', args);
            service.insertHtml('<hr>');
        });
    }
}

export type TextAlignment = 'center' | 'justify' | 'left' | 'right';

/** Registers explicit block alignment. */
export class AlignmentPlugin extends FeaturePlugin {
    static readonly id = 'alignment';
    override init(): void {
        this.register('format.alignment', (service, args) => {
            const value = oneArgument('format.alignment', args);
            if (
                value !== 'left' &&
                value !== 'center' &&
                value !== 'right' &&
                value !== 'justify'
            ) {
                throw new RichTextArgumentError(
                    'format.alignment',
                    'requires left, center, right, or justify.',
                );
            }
            requireExtendedCapability(
                service.setAlignment,
                'format.alignment',
            )(value);
        });
    }
}

/** Registers bounded block/list indentation commands. */
export class IndentationPlugin extends FeaturePlugin {
    static readonly id = 'indentation';
    override init(): void {
        this.register('format.indent', (service, args) => {
            assertNoArguments('format.indent', args);
            requireExtendedCapability(service.adjustIndent, 'format.indent')(1);
        });
        this.register('format.outdent', (service, args) => {
            assertNoArguments('format.outdent', args);
            requireExtendedCapability(
                service.adjustIndent,
                'format.outdent',
            )(-1);
        });
    }
}

export interface SemanticStyleAttribute {
    readonly name: string;
    readonly value: string;
}

export type SemanticStyleDefinition =
    | {
          readonly attributes: readonly SemanticStyleAttribute[];
          readonly element?: VisualBlockTag;
          readonly id: string;
          readonly label: string;
          readonly target: 'block';
      }
    | {
          readonly attributes: readonly SemanticStyleAttribute[];
          readonly element: VisualInlineStyle['tagName'];
          readonly id: string;
          readonly label: string;
          readonly target: 'inline';
      }
    | {
          readonly attributes: readonly SemanticStyleAttribute[];
          readonly id: string;
          readonly label: string;
          readonly objectType: string;
          readonly target: 'structured';
      };

/** Reports malformed or unsafe instance-scoped CMS style definitions. */
export class SemanticStyleConfigurationError extends TypeError {
    constructor(message: string) {
        super(`Invalid CMS style configuration: ${message}`);
        this.name = 'SemanticStyleConfigurationError';
    }
}

/** Registers validated instance-scoped semantic style commands. */
export class SemanticStylesPlugin extends Plugin {
    static readonly id = 'semantic-styles';
    static readonly requires = [StructuredEditingPlugin];

    override init(): void {
        const definitions = readSemanticStyles(
            this.editor.config.get<unknown>('cms.styles'),
        );
        for (const definition of definitions) {
            const commandId = `style.${definition.id}`;
            this.editor.commands.register({
                id: commandId,
                label: definition.label,
                canExecute: ({ editor }) => {
                    const service = editor.services.tryGet(
                        visualEditingServiceToken,
                    );
                    return (
                        service?.canEdit() === true &&
                        (definition.target !== 'structured' ||
                            service.isStructuredBlockSelected(
                                definition.objectType,
                            ))
                    );
                },
                execute: (context, ...args) => {
                    assertNoArguments(commandId, args);
                    applySemanticStyle(
                        requireService(context, commandId),
                        definition,
                    );
                },
                isActive: ({ editor }) => {
                    const service = editor.services.tryGet(
                        visualEditingServiceToken,
                    );
                    return service === undefined
                        ? false
                        : isSemanticStyleActive(service, definition);
                },
            });
        }
    }
}

abstract class ToggleBlockPlugin extends FeaturePlugin {
    protected registerBlock(id: string, tagName: 'blockquote' | 'pre'): void {
        this.register(
            id,
            (service, args) => {
                assertNoArguments(id, args);
                service.setBlock(
                    service.isBlockActive(tagName) ? 'p' : tagName,
                );
            },
            (service) => service.isBlockActive(tagName),
            tagName === 'blockquote'
                ? 'Toggle blockquote'
                : 'Toggle code block',
        );
    }
}

/** Registers blockquote toggling. */
export class BlockquotePlugin extends ToggleBlockPlugin {
    static readonly id = 'blockquote';
    override init(): void {
        this.registerBlock('blockquote.toggle', 'blockquote');
    }
}

/** Registers minimal code-block toggling. */
export class CodeBlockPlugin extends ToggleBlockPlugin {
    static readonly id = 'code-block';
    override init(): void {
        this.registerBlock('codeBlock.toggle', 'pre');
    }
}

abstract class ListPlugin extends FeaturePlugin {
    protected registerList(id: string, list: 'ol' | 'ul'): void {
        this.register(
            id,
            (service, args) => {
                assertNoArguments(id, args);
                service.toggleList(list);
            },
            (service) => service.isListActive(list),
            list === 'ol' ? 'Toggle ordered list' : 'Toggle unordered list',
        );
    }
}

/** Registers ordered-list toggling. */
export class OrderedListPlugin extends ListPlugin {
    static readonly id = 'ordered-list';
    override init(): void {
        this.registerList('list.ordered', 'ol');
    }
}

/** Registers unordered-list toggling. */
export class UnorderedListPlugin extends ListPlugin {
    static readonly id = 'unordered-list';
    override init(): void {
        this.registerList('list.unordered', 'ul');
    }
}

/** Registers ordered/unordered list start and marker properties. */
export class ListPropertiesPlugin extends FeaturePlugin {
    static readonly id = 'list-properties';
    override init(): void {
        this.register('list.properties', (service, args) => {
            const properties = readListProperties(args);
            requireExtendedCapability(
                service.setListProperties,
                'list.properties',
            )(properties);
        });
    }
}

/** Options accepted by `link.set`. */
export type LinkOptions = VisualLinkAttributes;

export type LinkTargetSelection = LinkOptions;

export interface LinkTargetProvider {
    select(kind: 'file' | 'internal'): PromiseLike<LinkTargetSelection | null>;
}

export const linkTargetProviderServiceToken =
    createServiceToken<LinkTargetProvider>('soeditor.link-target-provider');

interface LinkPolicy {
    readonly allowRelative: boolean;
    readonly protocols: readonly string[];
}

interface LinkAttributeDefinition {
    readonly name: string;
    readonly values?: readonly string[];
}

const linkAttributeCatalog: readonly LinkAttributeDefinition[] = Object.freeze([
    ...[
        'download',
        'hreflang',
        'type',
        'id',
        'class',
        'lang',
        'role',
        'tabindex',
        'aria-label',
        'aria-describedby',
    ].map((name) => Object.freeze({ name })),
    Object.freeze({
        name: 'referrerpolicy',
        values: Object.freeze([
            'no-referrer',
            'no-referrer-when-downgrade',
            'origin',
            'origin-when-cross-origin',
            'same-origin',
            'strict-origin',
            'strict-origin-when-cross-origin',
            'unsafe-url',
        ]),
    }),
    Object.freeze({
        name: 'dir',
        values: Object.freeze(['ltr', 'rtl', 'auto']),
    }),
    Object.freeze({
        name: 'aria-current',
        values: Object.freeze([
            'page',
            'step',
            'location',
            'date',
            'time',
            'true',
            'false',
        ]),
    }),
]);

/** Registers link application and removal commands. */
export class LinkPlugin extends FeaturePlugin {
    static readonly id = 'link';

    override init(): void {
        const policy = readLinkPolicy(
            this.editor.config.get<unknown>('cms.links'),
        );
        this.editor.commands.register({
            id: 'link.attributes.catalog',
            label: 'List supported link attributes',
            canExecute: () => true,
            execute: (_context, ...args) => {
                assertNoArguments('link.attributes.catalog', args);
                return linkAttributeCatalog;
            },
        });
        this.register(
            'link.set',
            (service, args) => service.setLink(readLinkOptions(args, policy)),
            (service) => service.isLinkActive(),
        );
        this.register('link.setText', (service, args) => {
            const value = readRecord('link.setText', args);
            rejectUnknownKeys('link.setText', value, [
                'customAttributes',
                'href',
                'rel',
                'target',
                'text',
                'title',
            ]);
            const text = requiredString('link.setText', value, 'text');
            if (text.length > 100_000 || hasControlCharacters(text)) {
                throw new RichTextArgumentError(
                    'link.setText',
                    'requires bounded single-line displayed text.',
                );
            }
            const attributes = normalizeLinkOptions(
                {
                    href: requiredString('link.setText', value, 'href'),
                    ...optionalLinkCustomAttributes(
                        'link.setText',
                        value,
                        policy,
                    ),
                    ...optionalStringProperties('link.setText', value, [
                        'target',
                        'rel',
                        'title',
                    ]),
                },
                policy,
            );
            service.insertHtml(
                serializeNodes([
                    element('a', linkHtmlAttributes(attributes), [
                        Object.freeze({ type: 'text', value: text }),
                    ]),
                ]),
            );
        });
        this.register(
            'link.remove',
            (service, args) => {
                assertNoArguments('link.remove', args);
                service.setLink(undefined);
            },
            (service) => service.isLinkActive(),
            'Remove link',
        );
        this.register('link.auto', (service, args) => {
            const candidate = oneStringArgument('link.auto', args);
            service.setLink({ href: normalizeAutoLink(candidate, policy) });
        });
        this.editor.commands.register({
            id: 'link.inspect',
            label: 'Inspect selected link',
            canExecute: ({ editor }) =>
                resolveFeatureService(editor, 'link.inspect')?.isLinkActive() ??
                false,
            execute: ({ editor }, ...args) => {
                assertNoArguments('link.inspect', args);
                return resolveFeatureService(
                    editor,
                    'link.inspect',
                )?.getLinkAttributes?.();
            },
        });
        this.editor.commands.register({
            id: 'link.pick',
            label: 'Select a CMS link target',
            canExecute: ({ editor }) =>
                editor.services.has(linkTargetProviderServiceToken) &&
                (resolveFeatureService(editor, 'link.pick')?.canEdit() ??
                    false),
            execute: async ({ editor }, kind) => {
                if (kind !== 'file' && kind !== 'internal') {
                    throw new RichTextArgumentError(
                        'link.pick',
                        'requires "file" or "internal".',
                    );
                }
                const selected = await editor.services
                    .get(linkTargetProviderServiceToken)
                    .select(kind);
                if (selected === null) return null;
                const options = normalizeLinkOptions(selected, policy);
                resolveFeatureService(editor, 'link.pick')?.setLink(options);
                return options;
            },
        });
    }
}

function markLabel(mark: VisualTextMark): string {
    switch (mark) {
        case 'strong':
            return 'Toggle bold';
        case 'em':
            return 'Toggle italic';
        case 'u':
            return 'Toggle underline';
        case 's':
            return 'Toggle strikethrough';
        case 'code':
            return 'Toggle inline code';
        case 'sub':
            return 'Toggle subscript';
        case 'sup':
            return 'Toggle superscript';
    }
}

function readSemanticStyles(
    value: unknown,
): readonly SemanticStyleDefinition[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 64) {
        throw new SemanticStyleConfigurationError(
            'cms.styles must be an array with at most 64 entries.',
        );
    }
    const seen = new Set<string>();
    return Object.freeze(
        value.map((candidate, index) => {
            if (
                typeof candidate !== 'object' ||
                candidate === null ||
                Array.isArray(candidate)
            ) {
                throw new SemanticStyleConfigurationError(
                    `entry ${String(index)} must be an object.`,
                );
            }
            const record = candidate as Record<string, unknown>;
            const id = styleString(record, 'id', index);
            const label = styleString(record, 'label', index);
            if (!/^[a-z][a-z0-9-]{0,47}$/u.test(id) || seen.has(id)) {
                throw new SemanticStyleConfigurationError(
                    `entry ${String(index)} has an invalid or duplicate id.`,
                );
            }
            seen.add(id);
            const attributes = styleAttributes(record.attributes, index);
            if (record.target === 'inline') {
                if (
                    record.element !== 'span' &&
                    record.element !== 'mark' &&
                    record.element !== 'small' &&
                    record.element !== 'kbd'
                ) {
                    throw new SemanticStyleConfigurationError(
                        `inline entry "${id}" requires span, mark, small, or kbd.`,
                    );
                }
                return Object.freeze({
                    attributes,
                    element: record.element,
                    id,
                    label,
                    target: 'inline' as const,
                });
            }
            if (record.target === 'block') {
                const element = record.element;
                if (element !== undefined && !isVisualBlockTag(element)) {
                    throw new SemanticStyleConfigurationError(
                        `block entry "${id}" has an unsupported element.`,
                    );
                }
                return Object.freeze({
                    attributes,
                    ...(element === undefined ? {} : { element }),
                    id,
                    label,
                    target: 'block' as const,
                });
            }
            if (record.target === 'structured') {
                const objectType = styleString(record, 'objectType', index);
                return Object.freeze({
                    attributes,
                    id,
                    label,
                    objectType,
                    target: 'structured' as const,
                });
            }
            throw new SemanticStyleConfigurationError(
                `entry "${id}" has an unsupported target.`,
            );
        }),
    );
}

function styleString(
    record: Record<string, unknown>,
    key: string,
    index: number,
): string {
    const value = record[key];
    if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
        throw new SemanticStyleConfigurationError(
            `entry ${String(index)} requires a bounded string "${key}".`,
        );
    }
    return value;
}

function styleAttributes(
    value: unknown,
    index: number,
): readonly SemanticStyleAttribute[] {
    if (!Array.isArray(value) || value.length === 0 || value.length > 8) {
        throw new SemanticStyleConfigurationError(
            `entry ${String(index)} requires 1 to 8 attributes.`,
        );
    }
    return Object.freeze(
        value.map((candidate) => {
            if (
                typeof candidate !== 'object' ||
                candidate === null ||
                Array.isArray(candidate)
            ) {
                throw new SemanticStyleConfigurationError(
                    `entry ${String(index)} contains an invalid attribute.`,
                );
            }
            const record = candidate as Record<string, unknown>;
            const name = record.name;
            const attributeValue = record.value;
            if (
                typeof name !== 'string' ||
                typeof attributeValue !== 'string' ||
                !/^(?:class|dir|lang|style|title|data-[a-z0-9-]+)$/u.test(
                    name,
                ) ||
                attributeValue.length === 0 ||
                attributeValue.length > 512 ||
                (name === 'style' && !isSafeSemanticStyle(attributeValue))
            ) {
                throw new SemanticStyleConfigurationError(
                    `entry ${String(index)} contains an unsafe attribute.`,
                );
            }
            return Object.freeze({ name, value: attributeValue });
        }),
    );
}

function isSafeSemanticStyle(value: string): boolean {
    return /^(?:(?:color|background-color|font-family|font-size)\s*:\s*[-#(),.%\w\s"']+;?\s*)+$/iu.test(
        value,
    );
}

function isVisualBlockTag(value: unknown): value is VisualBlockTag {
    return (
        value === 'p' ||
        value === 'blockquote' ||
        value === 'pre' ||
        (typeof value === 'string' && /^h[1-6]$/u.test(value))
    );
}

function toHtmlAttributes(
    attributes: readonly SemanticStyleAttribute[],
): readonly HtmlAttribute[] {
    return Object.freeze(
        attributes.map(({ name, value }) => Object.freeze({ name, value })),
    );
}

function applySemanticStyle(
    service: VisualEditingService,
    definition: SemanticStyleDefinition,
): void {
    const attributes = toHtmlAttributes(definition.attributes);
    if (definition.target === 'inline') {
        requireExtendedCapability(
            service.applyInlineStyle,
            `style.${definition.id}`,
        )({
            attributes,
            tagName: definition.element,
        });
    } else if (definition.target === 'block') {
        if (definition.element !== undefined)
            service.setBlock(definition.element);
        requireExtendedCapability(
            service.applyBlockAttributes,
            `style.${definition.id}`,
        )(attributes);
    } else {
        const block = service.getSelectedStructuredBlock(definition.objectType);
        if (block === undefined) return;
        service.setStructuredBlockAttributes(
            definition.objectType,
            mergeAttributes(block.attributes, attributes),
        );
    }
}

function isSemanticStyleActive(
    service: VisualEditingService,
    definition: SemanticStyleDefinition,
): boolean {
    const attributes = toHtmlAttributes(definition.attributes);
    if (definition.target === 'inline') {
        return (
            service.isInlineStyleActive?.({
                attributes,
                tagName: definition.element,
            }) ?? false
        );
    }
    if (definition.target === 'block') {
        return (
            (definition.element === undefined ||
                service.isBlockActive(definition.element)) &&
            (service.areBlockAttributesActive?.(attributes) ?? false)
        );
    }
    const block = service.getSelectedStructuredBlock(definition.objectType);
    return (
        block !== undefined &&
        attributes.every((attribute) =>
            block.attributes.some(
                (candidate) =>
                    candidate.name === attribute.name &&
                    candidate.value === attribute.value,
            ),
        )
    );
}

function mergeAttributes(
    current: readonly HtmlAttribute[],
    added: readonly HtmlAttribute[],
): readonly HtmlAttribute[] {
    const names = new Set(added.map(({ name }) => name));
    return Object.freeze([
        ...current.filter(({ name }) => !names.has(name)),
        ...added,
    ]);
}

function requireExtendedCapability<T>(
    capability: T | undefined,
    commandId: string,
): T {
    if (capability === undefined) {
        throw new Error(
            `Command "${commandId}" requires the CMS formatting engine capability.`,
        );
    }
    return capability;
}

/** Options accepted by `image.insert`. */
export interface ImageInsertOptions {
    readonly src: string;
    readonly alt?: string;
    readonly width?: number;
    readonly height?: number;
}

/** Registers inert semantic image insertion. */
export class ImagePlugin extends FeaturePlugin {
    static readonly id = 'image';

    override init(): void {
        this.register('image.insert', (service, args) => {
            const options = readImageOptions(args);
            const attributes: HtmlAttribute[] = [attribute('src', options.src)];
            if (options.alt !== undefined) {
                attributes.push(attribute('alt', options.alt));
            }
            if (options.width !== undefined) {
                attributes.push(attribute('width', String(options.width)));
            }
            if (options.height !== undefined) {
                attributes.push(attribute('height', String(options.height)));
            }
            service.insertHtml(serializeNodes([element('img', attributes)]));
        });
    }
}

function requireService(
    context: CommandContext,
    commandId: string,
): VisualEditingService {
    const service = context.editor.services.tryGet(visualEditingServiceToken);
    if (service === undefined) {
        throw new Error(
            `Command "${commandId}" requires an attached visual editing engine.`,
        );
    }
    return service;
}

function resolveFeatureService(
    editor: CommandContext['editor'],
    commandId: string,
): VisualEditingService | undefined {
    const nested = editor.services.tryGet(nestedEditingBridgeToken);
    if (nested !== undefined) {
        const active = nested.getActive(commandId);
        if (active !== undefined) return active;
        if (nested.getActive('*') !== undefined) return undefined;
    }
    return editor.services.tryGet(visualEditingServiceToken);
}

function requireFeatureService(
    context: CommandContext,
    commandId: string,
): VisualEditingService {
    const service = resolveFeatureService(context.editor, commandId);
    if (service === undefined) {
        throw new Error(
            `Command "${commandId}" requires an editable rich-text selection.`,
        );
    }
    return service;
}

function assertNoArguments(commandId: string, args: readonly unknown[]): void {
    if (args.length !== 0) {
        throw new RichTextArgumentError(
            commandId,
            'does not accept arguments.',
        );
    }
}

function oneArgument(commandId: string, args: readonly unknown[]): unknown {
    if (args.length !== 1) {
        throw new RichTextArgumentError(
            commandId,
            'requires exactly one argument.',
        );
    }
    return args[0];
}

function readRecord(
    commandId: string,
    args: readonly unknown[],
): Record<string, unknown> {
    const value = oneArgument(commandId, args);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new RichTextArgumentError(
            commandId,
            'requires an options object.',
        );
    }
    return value as Record<string, unknown>;
}

function readLinkOptions(
    args: readonly unknown[],
    policy: LinkPolicy,
): LinkOptions {
    const value = readRecord('link.set', args);
    rejectUnknownKeys('link.set', value, [
        'customAttributes',
        'href',
        'target',
        'rel',
        'title',
    ]);
    const href = requiredString('link.set', value, 'href');
    return normalizeLinkOptions(
        {
            href,
            ...optionalLinkCustomAttributes('link.set', value, policy),
            ...optionalStringProperties('link.set', value, [
                'target',
                'rel',
                'title',
            ]),
        },
        policy,
    );
}

function normalizeLinkOptions(
    options: LinkTargetSelection,
    policy: LinkPolicy,
): LinkOptions {
    if (
        typeof options !== 'object' ||
        options === null ||
        typeof options.href !== 'string' ||
        (options.title !== undefined &&
            (typeof options.title !== 'string' ||
                options.title.length > 512 ||
                hasControlCharacters(options.title))) ||
        (options.target !== undefined && typeof options.target !== 'string') ||
        (options.rel !== undefined &&
            (typeof options.rel !== 'string' || options.rel.length > 512)) ||
        (options.customAttributes !== undefined &&
            !Array.isArray(options.customAttributes))
    ) {
        throw new RichTextArgumentError(
            'link.set',
            'requires bounded string properties.',
        );
    }
    const href = options.href.trim();
    if (!isAllowedLink(href, policy)) {
        throw new RichTextArgumentError(
            'link.set',
            'requires a safe URL allowed by cms.links policy.',
        );
    }
    const target = normalizeLinkTarget(options.target);
    const rel = normalizeRel(options.rel, target);
    const customAttributes = normalizeLinkCustomAttributes(
        options.customAttributes,
        policy,
    );
    return Object.freeze({
        href,
        ...(target === undefined ? {} : { target }),
        ...(rel === undefined ? {} : { rel }),
        ...(options.title === undefined ? {} : { title: options.title }),
        ...(customAttributes === undefined ? {} : { customAttributes }),
    });
}

const managedLinkAttributeNames = new Set(['href', 'rel', 'target', 'title']);
const blockedLinkAttributeNames = new Set([
    'is',
    'nonce',
    'srcdoc',
    'style',
    'xmlns',
]);
const linkReferrerPolicies = new Set([
    '',
    'no-referrer',
    'no-referrer-when-downgrade',
    'origin',
    'origin-when-cross-origin',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url',
]);
function optionalLinkCustomAttributes(
    commandId: string,
    value: Record<string, unknown>,
    policy: LinkPolicy,
): Readonly<{ customAttributes?: readonly HtmlAttribute[] }> {
    if (!Object.hasOwn(value, 'customAttributes')) return {};
    return {
        customAttributes: normalizeLinkCustomAttributes(
            value.customAttributes,
            policy,
            commandId,
        )!,
    };
}

function normalizeLinkCustomAttributes(
    value: unknown,
    policy: LinkPolicy,
    commandId = 'link.set',
): readonly HtmlAttribute[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length > 32) {
        throw new RichTextArgumentError(
            commandId,
            'customAttributes must be an array with at most 32 entries.',
        );
    }
    const names = new Set<string>();
    return Object.freeze(
        value.map((entry: unknown, index): HtmlAttribute => {
            if (
                typeof entry !== 'object' ||
                entry === null ||
                Array.isArray(entry)
            ) {
                throw new RichTextArgumentError(
                    commandId,
                    `customAttributes[${String(index)}] must contain a name and value.`,
                );
            }
            const record = entry as Record<string, unknown>;
            if (
                Object.keys(record).some(
                    (key) => key !== 'name' && key !== 'value',
                ) ||
                typeof record.name !== 'string' ||
                typeof record.value !== 'string'
            ) {
                throw new RichTextArgumentError(
                    commandId,
                    `customAttributes[${String(index)}] must contain only string name and value properties.`,
                );
            }
            const name = record.name.trim().toLowerCase();
            const attributeValue = record.value;
            if (!/^[a-z][a-z0-9_.:-]{0,63}$/u.test(name)) {
                throw new RichTextArgumentError(
                    commandId,
                    `custom attribute name "${name}" is invalid.`,
                );
            }
            if (
                managedLinkAttributeNames.has(name) ||
                blockedLinkAttributeNames.has(name) ||
                name.startsWith('on') ||
                name.startsWith('data-soeditor-')
            ) {
                throw new RichTextArgumentError(
                    commandId,
                    `custom attribute name "${name}" is reserved or unsafe.`,
                );
            }
            if (
                !linkAttributeCatalog.some(
                    ({ name: allowed }) => allowed === name,
                ) &&
                !/^data-[a-z0-9_.:-]+$/u.test(name)
            ) {
                throw new RichTextArgumentError(
                    commandId,
                    `custom attribute name "${name}" is not supported for links.`,
                );
            }
            if (names.has(name)) {
                throw new RichTextArgumentError(
                    commandId,
                    `custom attribute name "${name}" is duplicated.`,
                );
            }
            if (
                attributeValue.length > 4096 ||
                hasControlCharacters(attributeValue)
            ) {
                throw new RichTextArgumentError(
                    commandId,
                    `custom attribute "${name}" requires a bounded value without control characters.`,
                );
            }
            validateLinkCustomAttributeValue(
                commandId,
                name,
                attributeValue,
                policy,
            );
            names.add(name);
            return Object.freeze({ name, value: attributeValue });
        }),
    );
}

function validateLinkCustomAttributeValue(
    commandId: string,
    name: string,
    value: string,
    policy: LinkPolicy,
): void {
    const invalid = (requirement: string): never => {
        throw new RichTextArgumentError(
            commandId,
            `custom attribute "${name}" ${requirement}.`,
        );
    };
    if (name === 'referrerpolicy' && !linkReferrerPolicies.has(value)) {
        invalid('requires a standard referrer policy value');
    }
    if (name === 'dir' && !['auto', 'ltr', 'rtl'].includes(value)) {
        invalid('requires auto, ltr, or rtl');
    }
    if (name === 'tabindex') {
        const number = Number(value);
        if (
            !/^-?\d{1,5}$/u.test(value) ||
            !Number.isInteger(number) ||
            number < -32_768 ||
            number > 32_767
        ) {
            invalid('requires an integer from -32768 to 32767');
        }
    }
    if (name === 'id' && (value.length === 0 || /\s/u.test(value))) {
        invalid('requires a non-empty value without whitespace');
    }
    if (
        (name === 'lang' || name === 'hreflang') &&
        value.length > 0 &&
        !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u.test(value)
    ) {
        invalid('requires a valid language tag');
    }
    if (
        name === 'type' &&
        value.length > 0 &&
        !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+(?:\s*;\s*[a-zA-Z0-9!#$&^_.+-]+=[^;\r\n]+)*$/u.test(
            value,
        )
    ) {
        invalid('requires a MIME type');
    }
    if (
        name === 'aria-current' &&
        !['page', 'step', 'location', 'date', 'time', 'true', 'false'].includes(
            value,
        )
    ) {
        invalid('requires a standard aria-current value');
    }
    if (
        name === 'role' &&
        !/^[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)*$/u.test(value)
    ) {
        invalid('requires one or more lowercase role tokens');
    }
    if (name === 'ping') {
        const urls = value.trim().split(/\s+/u).filter(Boolean);
        if (
            urls.length === 0 ||
            urls.length > 8 ||
            urls.some((url) => !isAllowedLink(url, policy))
        ) {
            invalid('requires at most 8 safe URLs allowed by cms.links policy');
        }
    }
}

function linkHtmlAttributes(options: LinkOptions): readonly HtmlAttribute[] {
    return Object.freeze([
        attribute('href', options.href),
        ...(options.target === undefined
            ? []
            : [attribute('target', options.target)]),
        ...(options.rel === undefined ? [] : [attribute('rel', options.rel)]),
        ...(options.title === undefined
            ? []
            : [attribute('title', options.title)]),
        ...(options.customAttributes ?? []),
    ]);
}

function normalizeLinkTarget(value: string | undefined): string | undefined {
    if (value === undefined || value.trim().length === 0) return undefined;
    const target = value.trim();
    const specialTargets = new Set(['_blank', '_parent', '_self', '_top']);
    if (
        !specialTargets.has(target) &&
        !/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/u.test(target)
    ) {
        throw new RichTextArgumentError(
            'link.set',
            'requires _self, _blank, _parent, _top, or a custom target name beginning with a letter.',
        );
    }
    return target;
}

function readLinkPolicy(value: unknown): LinkPolicy {
    if (value === undefined) {
        return Object.freeze({
            allowRelative: true,
            protocols: Object.freeze(['http', 'https', 'mailto', 'tel']),
        });
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('cms.links must be an object.');
    }
    const record = value as Record<string, unknown>;
    const allowRelative = record.allowRelative ?? true;
    const protocols = record.protocols ?? ['http', 'https', 'mailto', 'tel'];
    if (typeof allowRelative !== 'boolean') {
        throw new TypeError('cms.links.allowRelative must be boolean.');
    }
    if (
        !Array.isArray(protocols) ||
        protocols.length < 1 ||
        protocols.length > 16 ||
        !protocols.every(
            (protocol) =>
                typeof protocol === 'string' &&
                /^[a-z][a-z0-9+.-]{0,31}$/u.test(protocol) &&
                !['data', 'file', 'javascript', 'vbscript'].includes(protocol),
        )
    ) {
        throw new TypeError('cms.links.protocols contains an unsafe protocol.');
    }
    return Object.freeze({
        allowRelative,
        protocols: Object.freeze([...new Set(protocols)]),
    });
}

function isAllowedLink(value: string, policy: LinkPolicy): boolean {
    if (
        value.length === 0 ||
        value.length > 2048 ||
        hasControlCharacters(value) ||
        value.includes('\\')
    ) {
        return false;
    }
    const scheme = /^([a-z][a-z0-9+.-]*):/iu.exec(value)?.[1]?.toLowerCase();
    if (scheme !== undefined) {
        if (!policy.protocols.includes(scheme)) return false;
        if (scheme === 'http' || scheme === 'https') {
            try {
                const parsed = new URL(value);
                return (
                    parsed.protocol === `${scheme}:` &&
                    parsed.hostname.length > 0 &&
                    parsed.username.length === 0 &&
                    parsed.password.length === 0
                );
            } catch {
                return false;
            }
        }
        return true;
    }
    return (
        policy.allowRelative &&
        !value.startsWith('//') &&
        /^(?:#|\?|\/|\.\.?(?:\/|$)|[^\s:]+(?:\/[^\s]*)?)$/u.test(value)
    );
}

function hasControlCharacters(value: string): boolean {
    return Array.from(value).some((character) => {
        const code = character.codePointAt(0);
        return code !== undefined && (code < 32 || code === 127);
    });
}

function normalizeRel(
    value: string | undefined,
    target: string | undefined,
): string | undefined {
    const tokens = (value ?? '')
        .split(/\s+/u)
        .filter((token) => token.length > 0)
        .map((token) => token.toLowerCase());
    if (tokens.some((token) => !/^[a-z][a-z0-9.-]{0,63}$/u.test(token))) {
        throw new RichTextArgumentError(
            'link.set',
            'contains an invalid rel token.',
        );
    }
    if (target === '_blank') tokens.push('noopener', 'noreferrer');
    const normalized = [...new Set(tokens)].sort().join(' ');
    return normalized.length === 0 ? undefined : normalized;
}

function normalizeAutoLink(value: string, policy: LinkPolicy): string {
    const candidate = value.trim();
    const href = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(candidate)
        ? `mailto:${candidate}`
        : /^\+?[\d(). -]{7,32}$/u.test(candidate)
          ? `tel:${candidate.replace(/[().\s-]/gu, '')}`
          : /^www\./iu.test(candidate)
            ? `https://${candidate}`
            : candidate;
    if (!isAllowedLink(href, policy)) {
        throw new RichTextArgumentError(
            'link.auto',
            'could not derive a safe link.',
        );
    }
    return href;
}

function oneStringArgument(command: string, args: readonly unknown[]): string {
    const value = oneArgument(command, args);
    if (typeof value !== 'string') {
        throw new RichTextArgumentError(command, 'requires a string.');
    }
    return value;
}

function readImageOptions(args: readonly unknown[]): ImageInsertOptions {
    const value = readRecord('image.insert', args);
    rejectUnknownKeys('image.insert', value, ['src', 'alt', 'width', 'height']);
    const src = requiredString('image.insert', value, 'src');
    const strings = optionalStringProperties('image.insert', value, ['alt']);
    const width = optionalPositiveInteger('image.insert', value, 'width');
    const height = optionalPositiveInteger('image.insert', value, 'height');
    return {
        src,
        ...strings,
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
    };
}

function readListProperties(args: readonly unknown[]): VisualListProperties {
    const value = readRecord('list.properties', args);
    rejectUnknownKeys('list.properties', value, ['start', 'type']);
    const start = value.start;
    const type = value.type;
    if (
        start !== undefined &&
        (!Number.isInteger(start) ||
            Number(start) < -999_999 ||
            Number(start) > 999_999)
    ) {
        throw new RichTextArgumentError(
            'list.properties',
            'requires a bounded integer "start".',
        );
    }
    if (
        type !== undefined &&
        type !== '1' &&
        type !== 'a' &&
        type !== 'A' &&
        type !== 'i' &&
        type !== 'I' &&
        type !== 'disc' &&
        type !== 'circle' &&
        type !== 'square'
    ) {
        throw new RichTextArgumentError(
            'list.properties',
            'requires a supported marker "type".',
        );
    }
    return {
        ...(start === undefined ? {} : { start: Number(start) }),
        ...(type === undefined ? {} : { type }),
    };
}

function rejectUnknownKeys(
    commandId: string,
    value: Record<string, unknown>,
    allowed: readonly string[],
): void {
    const unknown = Object.keys(value).find((key) => !allowed.includes(key));
    if (unknown !== undefined) {
        throw new RichTextArgumentError(
            commandId,
            `does not support option "${unknown}".`,
        );
    }
}

function requiredString(
    commandId: string,
    value: Record<string, unknown>,
    key: string,
): string {
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.length === 0) {
        throw new RichTextArgumentError(
            commandId,
            `requires a non-empty string "${key}".`,
        );
    }
    return candidate;
}

function optionalStringProperties(
    commandId: string,
    value: Record<string, unknown>,
    keys: readonly string[],
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
        const candidate = value[key];
        if (candidate !== undefined && typeof candidate !== 'string') {
            throw new RichTextArgumentError(
                commandId,
                `requires string option "${key}" when provided.`,
            );
        }
        if (typeof candidate === 'string') {
            result[key] = candidate;
        }
    }
    return result;
}

function positiveInteger(
    commandId: string,
    value: Record<string, unknown>,
    key: string,
): number {
    const candidate = value[key];
    if (!Number.isInteger(candidate) || Number(candidate) <= 0) {
        throw new RichTextArgumentError(
            commandId,
            `requires a positive integer "${key}".`,
        );
    }
    return Number(candidate);
}

function optionalPositiveInteger(
    commandId: string,
    value: Record<string, unknown>,
    key: string,
): number | undefined {
    return value[key] === undefined
        ? undefined
        : positiveInteger(commandId, value, key);
}

function attribute(name: string, value: string): HtmlAttribute {
    return Object.freeze({ name, value });
}

function element(
    tagName: string,
    attributes: readonly HtmlAttribute[] = [],
    children: readonly HtmlChildNode[] = [],
): HtmlElement {
    return Object.freeze({
        attributes: Object.freeze([...attributes]),
        children: Object.freeze([...children]),
        namespace: 'html',
        tagName,
        type: 'element',
    });
}

function serializeNodes(children: readonly HtmlChildNode[]): string {
    return serializeHtmlFragment(
        Object.freeze({
            children: Object.freeze([...children]),
            type: 'document-fragment',
        }),
    );
}
