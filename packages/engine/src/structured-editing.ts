import {
    createServiceToken,
    EditorDestroyedError,
    Plugin,
} from '@soeditor/core';
import type { HtmlChildNode, HtmlElement } from '@soeditor/html';

import type { EditingStructuredBlock } from './model.js';

/** Rendering/editing behavior available to a structured block before node views. */
export type StructuredBlockBehavior = 'atomic' | 'readonly';

/** Public source conversion supplied by a structured-editing feature plugin. */
export interface StructuredBlockConversion {
    /** Stable contribution identity used for diagnostics and conflicts. */
    readonly id: string;
    /** Stable structured node type produced by this conversion. */
    readonly type: string;
    /** Initial non-editable behavior used by the controlled visual projection. */
    readonly behavior: StructuredBlockBehavior;
    /** Returns whether this conversion owns a source node. Must be deterministic. */
    readonly matches: (node: HtmlElement) => boolean;
    /** Converts a matched source node into public structured block data. */
    readonly fromHtml: (
        node: HtmlElement,
    ) => Pick<EditingStructuredBlock, 'attributes' | 'children'>;
    /** Converts a structured block back to a SoEditor HTML node. */
    readonly toHtml: (block: EditingStructuredBlock) => HtmlElement;
}

/** Per-editor registration surface for structured editing contributions. */
export interface StructuredEditingRegistry {
    /**
     * Registers one block conversion. Its disposer removes an unsealed
     * contribution and becomes a safe no-op after a Visual schema is sealed.
     */
    registerBlock(conversion: StructuredBlockConversion): () => void;
    /** Registers one DOM view factory for an existing structured node type. */
    registerNodeView(
        type: string,
        factory: StructuredNodeViewFactory,
    ): () => void;
}

/** Immutable state supplied when a structured node view is mounted or updated. */
export interface StructuredNodeViewState {
    readonly node: EditingStructuredBlock;
    /** Editing projection requesting the node view. */
    readonly projectionId: 'visual' | 'wysiwyg';
    readonly readonly: boolean;
    readonly selected: boolean;
}

/** Narrow engine actions available to one structured node view. */
export interface StructuredNodeViewActions {
    /** Selects the whole structured block in the controlled visual model. */
    select(options?: StructuredNodeViewSelectionOptions): void;
    /** Executes a registered editor command without exposing the Editor object. */
    execute(commandId: string, ...args: readonly unknown[]): unknown;
}

/** Focus behavior requested while selecting a structured node view. */
export interface StructuredNodeViewSelectionOptions {
    readonly focus?: boolean;
}

/** Mount context supplied to a host-scoped node-view factory. */
export interface StructuredNodeViewContext extends StructuredNodeViewState {
    readonly actions: StructuredNodeViewActions;
    readonly document: Document;
}

/** DOM instance returned by a structured node-view factory. */
export interface StructuredNodeViewInstance {
    readonly element: HTMLElement;
    update?(state: StructuredNodeViewState): void;
    destroy?(): void;
}

/** Framework-neutral factory for one structured node-view instance. */
export type StructuredNodeViewFactory = (
    context: StructuredNodeViewContext,
) => StructuredNodeViewInstance;

/** Typed identity of the per-editor structured-editing contribution registry. */
export const structuredEditingRegistryToken =
    createServiceToken<StructuredEditingRegistry>(
        'soeditor.structured-editing-registry',
    );

/** Reports a duplicate contribution ID or structured node type. */
export class StructuredEditingContributionAlreadyRegisteredError extends Error {
    constructor(kind: 'ID' | 'node type' | 'node view', value: string) {
        super(
            `Structured editing contribution ${kind} "${value}" is already registered.`,
        );
        this.name = 'StructuredEditingContributionAlreadyRegisteredError';
    }
}

/** Reports a contribution that ambiguously owns the same HTML source node. */
export class StructuredEditingContributionConflictError extends Error {
    constructor(ids: readonly string[]) {
        super(
            `Structured editing contributions ${ids.map((id) => `"${id}"`).join(', ')} match the same HTML node.`,
        );
        this.name = 'StructuredEditingContributionConflictError';
    }
}

/** Reports mutation of a schema after an editing engine has consumed it. */
export class StructuredEditingRegistrySealedError extends Error {
    constructor() {
        super(
            'Structured editing contributions cannot change after an editing engine has attached.',
        );
        this.name = 'StructuredEditingRegistrySealedError';
    }
}

/** @internal Immutable schema consumed by one attached visual engine. */
export interface StructuredEditingSchema {
    readonly conversions: readonly StructuredBlockConversion[];
    readonly nodeViews: readonly (readonly [
        string,
        StructuredNodeViewFactory,
    ])[];
}

interface RegistryRecord {
    readonly byId: Map<string, StructuredBlockConversion>;
    readonly byType: Map<string, StructuredBlockConversion>;
    readonly nodeViews: Map<string, StructuredNodeViewFactory>;
    destroyed: boolean;
    sealed: boolean;
}

const records = new WeakMap<StructuredEditingRegistry, RegistryRecord>();
const emptySchema: StructuredEditingSchema = Object.freeze({
    conversions: Object.freeze([]),
    nodeViews: Object.freeze([]),
});

/** Installs the per-editor registry required by structured feature plugins. */
export class StructuredEditingPlugin extends Plugin {
    static readonly id = 'structured-editing';
    #registry: StructuredEditingRegistry | undefined;

    override init(): void {
        const record: RegistryRecord = {
            byId: new Map(),
            byType: new Map(),
            destroyed: false,
            nodeViews: new Map(),
            sealed: false,
        };
        const registry = Object.freeze<StructuredEditingRegistry>({
            registerBlock: (conversion) => registerBlock(record, conversion),
            registerNodeView: (type, factory) =>
                registerNodeView(record, type, factory),
        });
        records.set(registry, record);
        this.#registry = registry;
        this.editor.services.register(structuredEditingRegistryToken, registry);
    }

    override destroy(): void {
        const registry = this.#registry;
        if (registry !== undefined) {
            const record = requireRecord(registry);
            record.destroyed = true;
            record.byId.clear();
            record.byType.clear();
            record.nodeViews.clear();
            try {
                if (
                    this.editor.services.tryGet(
                        structuredEditingRegistryToken,
                    ) === registry
                ) {
                    this.editor.services.unregister(
                        structuredEditingRegistryToken,
                    );
                }
            } catch (error: unknown) {
                if (!(error instanceof EditorDestroyedError)) {
                    throw error;
                }
            }
        }
        this.#registry = undefined;
    }
}

/** @internal Seals a registry after initial conversion succeeds. */
export function sealStructuredEditingRegistry(
    registry: StructuredEditingRegistry | undefined,
): StructuredEditingSchema {
    const schema = snapshotStructuredEditingRegistry(registry);
    if (registry !== undefined) {
        requireRecord(registry).sealed = true;
    }
    return schema;
}

/** @internal Reads a candidate schema without mutating registry lifecycle. */
export function snapshotStructuredEditingRegistry(
    registry: StructuredEditingRegistry | undefined,
): StructuredEditingSchema {
    if (registry === undefined) {
        return emptySchema;
    }
    const record = requireRecord(registry);
    assertRegistryAlive(record);
    return Object.freeze({
        conversions: Object.freeze([...record.byId.values()]),
        nodeViews: Object.freeze(
            [...record.nodeViews.entries()].map(([type, factory]) =>
                Object.freeze([type, factory] as const),
            ),
        ),
    });
}

/** @internal Resolves exactly one matching source conversion. */
export function findStructuredBlockConversion(
    schema: StructuredEditingSchema,
    node: HtmlChildNode,
): StructuredBlockConversion | undefined {
    if (node.type !== 'element') {
        return undefined;
    }
    const matches = schema.conversions.filter((conversion) =>
        conversion.matches(node),
    );
    if (matches.length > 1) {
        throw new StructuredEditingContributionConflictError(
            matches.map((conversion) => conversion.id),
        );
    }
    return matches[0];
}

/** @internal Resolves the serializer for a structured node type. */
export function getStructuredBlockConversion(
    schema: StructuredEditingSchema,
    type: string,
): StructuredBlockConversion | undefined {
    return schema.conversions.find((conversion) => conversion.type === type);
}

/** @internal Resolves a registered node-view factory by structured node type. */
export function getStructuredNodeViewFactory(
    schema: StructuredEditingSchema,
    type: string,
): StructuredNodeViewFactory | undefined {
    return schema.nodeViews.find(([candidate]) => candidate === type)?.[1];
}

function registerBlock(
    record: RegistryRecord,
    candidate: StructuredBlockConversion,
): () => void {
    assertRegistryAlive(record);
    if (record.sealed) {
        throw new StructuredEditingRegistrySealedError();
    }
    const conversion = freezeConversion(candidate);
    if (record.byId.has(conversion.id)) {
        throw new StructuredEditingContributionAlreadyRegisteredError(
            'ID',
            conversion.id,
        );
    }
    if (record.byType.has(conversion.type)) {
        throw new StructuredEditingContributionAlreadyRegisteredError(
            'node type',
            conversion.type,
        );
    }
    record.byId.set(conversion.id, conversion);
    record.byType.set(conversion.type, conversion);
    let active = true;
    return () => {
        if (!active) {
            return;
        }
        if (record.sealed) {
            active = false;
            return;
        }
        if (record.byId.get(conversion.id) === conversion) {
            record.byId.delete(conversion.id);
            record.byType.delete(conversion.type);
        }
        active = false;
    };
}

function registerNodeView(
    record: RegistryRecord,
    type: string,
    factory: StructuredNodeViewFactory,
): () => void {
    assertRegistryAlive(record);
    if (record.sealed) {
        throw new StructuredEditingRegistrySealedError();
    }
    assertIdentifier('structured node type', type);
    if (!record.byType.has(type)) {
        throw new TypeError(
            `Structured node view "${type}" requires a registered block conversion.`,
        );
    }
    if (typeof factory !== 'function') {
        throw new TypeError(
            `Structured node view "${type}" requires a factory.`,
        );
    }
    if (record.nodeViews.has(type)) {
        throw new StructuredEditingContributionAlreadyRegisteredError(
            'node view',
            type,
        );
    }
    record.nodeViews.set(type, factory);
    let active = true;
    return () => {
        if (!active) {
            return;
        }
        if (!record.sealed && record.nodeViews.get(type) === factory) {
            record.nodeViews.delete(type);
        }
        active = false;
    };
}

function freezeConversion(
    conversion: StructuredBlockConversion,
): StructuredBlockConversion {
    if (typeof conversion !== 'object' || conversion === null) {
        throw new TypeError('A structured block conversion is required.');
    }
    assertIdentifier('contribution ID', conversion.id);
    assertIdentifier('structured node type', conversion.type);
    if (
        conversion.behavior !== 'atomic' &&
        conversion.behavior !== 'readonly'
    ) {
        throw new TypeError(
            `Structured editing contribution "${conversion.id}" requires behavior "atomic" or "readonly".`,
        );
    }
    if (
        typeof conversion.matches !== 'function' ||
        typeof conversion.fromHtml !== 'function' ||
        typeof conversion.toHtml !== 'function'
    ) {
        throw new TypeError(
            `Structured editing contribution "${conversion.id}" requires matches, fromHtml, and toHtml functions.`,
        );
    }
    return Object.freeze({ ...conversion });
}

function assertIdentifier(kind: string, value: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`A structured editing ${kind} must not be empty.`);
    }
}

function assertRegistryAlive(record: RegistryRecord): void {
    if (record.destroyed) {
        throw new Error('The structured editing registry has been destroyed.');
    }
}

function requireRecord(registry: StructuredEditingRegistry): RegistryRecord {
    const record = records.get(registry);
    if (record === undefined) {
        throw new TypeError(
            'The structured editing registry was not created by SoEditor.',
        );
    }
    return record;
}
