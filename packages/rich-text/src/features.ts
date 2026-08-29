import { Plugin, type CommandContext } from '@soeditor/core';
import {
    visualEditingServiceToken,
    type VisualBlockTag,
    type VisualEditingService,
    type VisualLinkAttributes,
    type VisualTextMark,
} from '@soeditor/engine';
import {
    serializeHtmlFragment,
    type HtmlAttribute,
    type HtmlChildNode,
    type HtmlElement,
} from '@soeditor/html';

/** Reports an invalid rich-text command argument without mutating the editor. */
export class RichTextArgumentError extends TypeError {
    constructor(commandId: string, message: string) {
        super(`Command "${commandId}" ${message}`);
        this.name = 'RichTextArgumentError';
    }
}

abstract class FeaturePlugin extends Plugin {
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
                editor.services.tryGet(visualEditingServiceToken)?.canEdit() ??
                false,
            execute: (context, ...args) =>
                execute(requireService(context, id), args),
            ...(isActive === undefined
                ? {}
                : {
                      isActive: ({ editor }: CommandContext) => {
                          const service = editor.services.tryGet(
                              visualEditingServiceToken,
                          );
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

/** Options accepted by `link.set`. */
export type LinkOptions = VisualLinkAttributes;

/** Registers link application and removal commands. */
export class LinkPlugin extends FeaturePlugin {
    static readonly id = 'link';

    override init(): void {
        this.register(
            'link.set',
            (service, args) => service.setLink(readLinkOptions(args)),
            (service) => service.isLinkActive(),
        );
        this.register(
            'link.remove',
            (service, args) => {
                assertNoArguments('link.remove', args);
                service.setLink(undefined);
            },
            (service) => service.isLinkActive(),
            'Remove link',
        );
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
    }
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

/** Bounded dimensions accepted by `table.insert`. */
export interface TableInsertOptions {
    readonly rows: number;
    readonly columns: number;
}

/** Registers inert semantic basic-table insertion. */
export class TablePlugin extends FeaturePlugin {
    static readonly id = 'table';

    override init(): void {
        this.register('table.insert', (service, args) => {
            const options = readTableOptions(args);
            const rows = Array.from({ length: options.rows }, () =>
                element(
                    'tr',
                    [],
                    Array.from({ length: options.columns }, () =>
                        element('td', [], [text('\u00a0')]),
                    ),
                ),
            );
            service.insertHtml(
                serializeNodes([
                    element('table', [], [element('tbody', [], rows)]),
                ]),
            );
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

function readLinkOptions(args: readonly unknown[]): LinkOptions {
    const value = readRecord('link.set', args);
    rejectUnknownKeys('link.set', value, ['href', 'target', 'rel', 'title']);
    const href = requiredString('link.set', value, 'href');
    return {
        href,
        ...optionalStringProperties('link.set', value, [
            'target',
            'rel',
            'title',
        ]),
    };
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

function readTableOptions(args: readonly unknown[]): TableInsertOptions {
    const value = readRecord('table.insert', args);
    rejectUnknownKeys('table.insert', value, ['rows', 'columns']);
    const rows = positiveInteger('table.insert', value, 'rows');
    const columns = positiveInteger('table.insert', value, 'columns');
    if (rows > 100 || columns > 100 || rows * columns > 1000) {
        throw new RichTextArgumentError(
            'table.insert',
            'supports at most 100 rows, 100 columns, and 1000 cells.',
        );
    }
    return { columns, rows };
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

function text(value: string): HtmlChildNode {
    return Object.freeze({ type: 'text', value });
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
