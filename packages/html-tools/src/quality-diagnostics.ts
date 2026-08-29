import { Plugin, type Config } from '@soeditor/core';
import {
    parseHtmlDocument,
    parseHtmlFragment,
    type HtmlDocumentChildNode,
    type HtmlElement,
    type SourceRange,
} from '@soeditor/html';

import { DiagnosticsPlugin, diagnosticsServiceToken } from './diagnostics.js';
import type {
    Diagnostic,
    DiagnosticProvider,
    ProblemSeverity,
} from './problems.js';

/** Stable accessibility rule identifiers supported by Phase 17. */
export type AccessibilityDiagnosticRuleCode =
    | 'a11y.form-label'
    | 'a11y.heading-order'
    | 'a11y.iframe-title'
    | 'a11y.interactive-name';

/** Stable SEO rule identifiers supported by Phase 17. */
export type SeoDiagnosticRuleCode =
    'seo.document-title' | 'seo.h1' | 'seo.meta-description';

/** A rule may be disabled or assigned an explicit SoEditor severity. */
export type DiagnosticRuleSetting = false | ProblemSeverity;

/** Per-instance accessibility rule settings at `htmlTools.accessibility.rules`. */
export interface AccessibilityDiagnosticsConfig {
    readonly rules?: Readonly<
        Partial<Record<AccessibilityDiagnosticRuleCode, DiagnosticRuleSetting>>
    >;
}

/** Per-instance SEO rule settings at `htmlTools.seo.rules`. */
export interface SeoDiagnosticsConfig {
    readonly rules?: Readonly<
        Partial<Record<SeoDiagnosticRuleCode, DiagnosticRuleSetting>>
    >;
}

/** Reports malformed or unknown per-rule configuration. */
export class InvalidDiagnosticRuleConfigurationError extends TypeError {
    constructor(path: string, message: string) {
        super(`Invalid diagnostic rule configuration at "${path}": ${message}`);
        this.name = 'InvalidDiagnosticRuleConfigurationError';
    }
}

const accessibilityDefaults = Object.freeze({
    'a11y.form-label': 'warning',
    'a11y.heading-order': 'warning',
    'a11y.iframe-title': 'warning',
    'a11y.interactive-name': 'warning',
} satisfies Record<AccessibilityDiagnosticRuleCode, ProblemSeverity>);

const seoDefaults = Object.freeze({
    'seo.document-title': 'warning',
    'seo.h1': 'info',
    'seo.meta-description': 'info',
} satisfies Record<SeoDiagnosticRuleCode, ProblemSeverity>);

/** Registers bounded source-only accessibility diagnostics. */
export class AccessibilityDiagnosticsPlugin extends Plugin {
    static readonly id = 'html-accessibility-diagnostics';
    static readonly requires = [DiagnosticsPlugin] as const;

    #unregister: (() => void) | undefined;

    override init(): void {
        const rules = resolveRules(
            this.editor.config,
            'htmlTools.accessibility.rules',
            accessibilityDefaults,
        );
        const provider: DiagnosticProvider = Object.freeze({
            id: 'html.accessibility',
            provide: (source: string) =>
                accessibilityDiagnostics(source, rules),
        });
        this.#unregister = this.editor.services
            .get(diagnosticsServiceToken)
            .register(provider);
    }

    override destroy(): void {
        this.#unregister?.();
        this.#unregister = undefined;
    }
}

/** Registers bounded source-only SEO diagnostics. */
export class SeoDiagnosticsPlugin extends Plugin {
    static readonly id = 'html-seo-diagnostics';
    static readonly requires = [DiagnosticsPlugin] as const;

    #unregister: (() => void) | undefined;

    override init(): void {
        const rules = resolveRules(
            this.editor.config,
            'htmlTools.seo.rules',
            seoDefaults,
        );
        const provider: DiagnosticProvider = Object.freeze({
            id: 'html.seo',
            provide: (source: string) => seoDiagnostics(source, rules),
        });
        this.#unregister = this.editor.services
            .get(diagnosticsServiceToken)
            .register(provider);
    }

    override destroy(): void {
        this.#unregister?.();
        this.#unregister = undefined;
    }
}

type RuleDefaults<Code extends string> = Readonly<
    Record<Code, ProblemSeverity>
>;
type ResolvedRules<Code extends string> = Readonly<
    Record<Code, DiagnosticRuleSetting>
>;

function resolveRules<Code extends string>(
    config: Config,
    path: string,
    defaults: RuleDefaults<Code>,
): ResolvedRules<Code> {
    const configured = config.get<unknown>(path);
    const resolved: Record<string, DiagnosticRuleSetting> = { ...defaults };

    if (configured === undefined) {
        return Object.freeze(resolved) as ResolvedRules<Code>;
    }
    if (
        typeof configured !== 'object' ||
        configured === null ||
        Array.isArray(configured)
    ) {
        throw new InvalidDiagnosticRuleConfigurationError(
            path,
            'expected an object keyed by a supported rule code.',
        );
    }

    for (const [code, setting] of Object.entries(configured)) {
        if (!Object.prototype.hasOwnProperty.call(defaults, code)) {
            throw new InvalidDiagnosticRuleConfigurationError(
                `${path}.${code}`,
                'unknown rule code.',
            );
        }
        if (setting !== false && !isSeverity(setting)) {
            throw new InvalidDiagnosticRuleConfigurationError(
                `${path}.${code}`,
                'expected false, "error", "warning", "info", or "hint".',
            );
        }
        resolved[code] = setting;
    }

    return Object.freeze(resolved) as ResolvedRules<Code>;
}

interface ParsedSource {
    readonly complete: boolean;
    readonly children: readonly HtmlDocumentChildNode[];
}

interface RenderedElement {
    readonly element: HtmlElement;
    readonly insideLabel: boolean;
}

function parseSource(source: string): ParsedSource {
    const complete = isCompleteDocument(source);
    const result = complete
        ? parseHtmlDocument(source)
        : parseHtmlFragment(source);
    return { complete, children: result.document.children };
}

function renderedElements(
    nodes: readonly HtmlDocumentChildNode[],
): readonly RenderedElement[] {
    const result: RenderedElement[] = [];

    const visit = (
        children: readonly HtmlDocumentChildNode[],
        insideLabel: boolean,
    ): void => {
        for (const node of children) {
            if (node.type !== 'element') {
                continue;
            }
            const isHtmlLabel =
                node.namespace === 'html' && node.tagName === 'label';
            result.push({ element: node, insideLabel });
            if (node.namespace === 'html' && node.tagName === 'template') {
                continue;
            }
            visit(node.children, insideLabel || isHtmlLabel);
        }
    };

    visit(nodes, false);
    return result;
}

function accessibilityDiagnostics(
    source: string,
    rules: ResolvedRules<AccessibilityDiagnosticRuleCode>,
): readonly Diagnostic[] {
    const parsed = parseSource(source);
    const elements = renderedElements(parsed.children);
    const diagnostics: Diagnostic[] = [];
    const labelledIds = new Set<string>();

    for (const { element } of elements) {
        if (isHtmlElement(element, 'label')) {
            const target = attributeValue(element, 'for')?.trim();
            if (target !== undefined && target.length > 0) {
                labelledIds.add(target);
            }
        }
    }

    for (const { element, insideLabel } of elements) {
        if (element.namespace !== 'html') {
            continue;
        }

        if (
            isRuleEnabled(rules, 'a11y.iframe-title') &&
            element.tagName === 'iframe'
        ) {
            const title = attributeValue(element, 'title');
            if (title === undefined || title.trim().length === 0) {
                diagnostics.push(
                    diagnostic(
                        rules,
                        'a11y.iframe-title',
                        'Iframe requires a non-empty title for an accessible name.',
                        attributeOrElementRange(element, 'title'),
                    ),
                );
            }
        }

        if (
            isRuleEnabled(rules, 'a11y.interactive-name') &&
            needsInteractiveName(element) &&
            !hasInteractiveName(element)
        ) {
            diagnostics.push(
                diagnostic(
                    rules,
                    'a11y.interactive-name',
                    'Interactive control requires a discernible accessible name.',
                    elementRange(element),
                ),
            );
        }

        if (
            isRuleEnabled(rules, 'a11y.form-label') &&
            isLabelledFormControl(element) &&
            !insideLabel &&
            !hasAriaName(element) &&
            !hasExternalLabel(element, labelledIds)
        ) {
            diagnostics.push(
                diagnostic(
                    rules,
                    'a11y.form-label',
                    'Form control requires an associated label or accessible name.',
                    elementRange(element),
                ),
            );
        }
    }

    if (parsed.complete && isRuleEnabled(rules, 'a11y.heading-order')) {
        let previousLevel = 0;
        for (const { element } of elements) {
            const level = headingLevel(element);
            if (level === undefined) {
                continue;
            }
            if (previousLevel > 0 && level > previousLevel + 1) {
                diagnostics.push(
                    diagnostic(
                        rules,
                        'a11y.heading-order',
                        `Heading level jumps from h${previousLevel} to h${level}.`,
                        elementRange(element),
                    ),
                );
            }
            previousLevel = level;
        }
    }

    return diagnostics;
}

function seoDiagnostics(
    source: string,
    rules: ResolvedRules<SeoDiagnosticRuleCode>,
): readonly Diagnostic[] {
    const parsed = parseSource(source);
    if (!parsed.complete) {
        return [];
    }

    const elements = renderedElements(parsed.children).map(
        ({ element }) => element,
    );
    const diagnostics: Diagnostic[] = [];
    const htmlTitles = elements.filter((element) =>
        isHtmlElement(element, 'title'),
    );
    const descriptions = elements.filter(
        (element) =>
            isHtmlElement(element, 'meta') &&
            attributeValue(element, 'name')?.toLowerCase() === 'description',
    );
    const h1s = elements.filter((element) => isHtmlElement(element, 'h1'));

    if (isRuleEnabled(rules, 'seo.document-title')) {
        if (htmlTitles.length === 0) {
            diagnostics.push(
                diagnostic(
                    rules,
                    'seo.document-title',
                    'Complete HTML document is missing a title element.',
                ),
            );
        } else if (
            htmlTitles.some(
                (element) => textContent(element).trim().length === 0,
            )
        ) {
            const emptyTitle = htmlTitles.find(
                (element) => textContent(element).trim().length === 0,
            );
            diagnostics.push(
                diagnostic(
                    rules,
                    'seo.document-title',
                    'Document title must not be empty.',
                    emptyTitle === undefined
                        ? undefined
                        : elementRange(emptyTitle),
                ),
            );
        } else if (htmlTitles.length > 1) {
            const duplicateTitle = htmlTitles.at(1);
            diagnostics.push(
                diagnostic(
                    rules,
                    'seo.document-title',
                    'Complete HTML document contains more than one title element.',
                    duplicateTitle === undefined
                        ? undefined
                        : elementRange(duplicateTitle),
                ),
            );
        }
    }

    if (isRuleEnabled(rules, 'seo.meta-description')) {
        const usefulDescription = descriptions.find(
            (element) =>
                (attributeValue(element, 'content') ?? '').trim().length > 0,
        );
        if (usefulDescription === undefined) {
            const firstDescription = descriptions.at(0);
            diagnostics.push(
                diagnostic(
                    rules,
                    'seo.meta-description',
                    descriptions.length === 0
                        ? 'Complete HTML document is missing a meta description.'
                        : 'Meta description must have non-empty content.',
                    firstDescription === undefined
                        ? undefined
                        : attributeOrElementRange(firstDescription, 'content'),
                ),
            );
        }
    }

    if (isRuleEnabled(rules, 'seo.h1')) {
        if (h1s.length === 0) {
            diagnostics.push(
                diagnostic(
                    rules,
                    'seo.h1',
                    'Complete HTML document has no h1 heading.',
                ),
            );
        } else if (h1s.length > 1) {
            const duplicateH1 = h1s.at(1);
            diagnostics.push(
                diagnostic(
                    rules,
                    'seo.h1',
                    'Complete HTML document contains more than one h1 heading.',
                    duplicateH1 === undefined
                        ? undefined
                        : elementRange(duplicateH1),
                ),
            );
        }
    }

    return diagnostics;
}

function diagnostic<Code extends string>(
    rules: ResolvedRules<Code>,
    code: Code,
    message: string,
    source?: SourceRange,
): Diagnostic {
    const severity = rules[code];
    if (severity === false) {
        throw new Error(`Disabled diagnostic rule "${code}" was emitted.`);
    }
    return {
        code,
        message,
        severity,
        ...(source === undefined ? {} : { source }),
    };
}

function isRuleEnabled<Code extends string>(
    rules: ResolvedRules<Code>,
    code: Code,
): boolean {
    return rules[code] !== false;
}

function isHtmlElement(element: HtmlElement, tagName: string): boolean {
    return element.namespace === 'html' && element.tagName === tagName;
}

function attributeValue(
    element: HtmlElement,
    name: string,
): string | undefined {
    return element.attributes.find((attribute) => attribute.name === name)
        ?.value;
}

function attributeOrElementRange(
    element: HtmlElement,
    name: string,
): SourceRange | undefined {
    return (
        element.attributes.find((attribute) => attribute.name === name)
            ?.source ?? elementRange(element)
    );
}

function elementRange(element: HtmlElement): SourceRange | undefined {
    return element.source?.startTag ?? element.source;
}

function textContent(element: HtmlElement): string {
    let result = '';
    for (const child of element.children) {
        if (child.type === 'text') {
            result += child.value;
        } else if (child.type === 'element' && child.tagName !== 'template') {
            result += textContent(child);
        }
    }
    return result;
}

function hasAriaName(element: HtmlElement): boolean {
    return ['aria-label', 'aria-labelledby'].some(
        (name) => (attributeValue(element, name) ?? '').trim().length > 0,
    );
}

function needsInteractiveName(element: HtmlElement): boolean {
    if (element.tagName === 'button') {
        return true;
    }
    if (element.tagName !== 'input') {
        return false;
    }
    const type = (attributeValue(element, 'type') ?? 'text').toLowerCase();
    return ['button', 'image', 'reset', 'submit'].includes(type);
}

function hasInteractiveName(element: HtmlElement): boolean {
    if (hasAriaName(element) || textContent(element).trim().length > 0) {
        return true;
    }
    const type = (attributeValue(element, 'type') ?? '').toLowerCase();
    const nativeName =
        type === 'image'
            ? attributeValue(element, 'alt')
            : attributeValue(element, 'value');
    return (nativeName ?? '').trim().length > 0;
}

function isLabelledFormControl(element: HtmlElement): boolean {
    if (element.tagName === 'textarea' || element.tagName === 'select') {
        return true;
    }
    if (element.tagName !== 'input') {
        return false;
    }
    const type = (attributeValue(element, 'type') ?? 'text').toLowerCase();
    return !['button', 'hidden', 'image', 'reset', 'submit'].includes(type);
}

function hasExternalLabel(
    element: HtmlElement,
    labelledIds: ReadonlySet<string>,
): boolean {
    const id = attributeValue(element, 'id');
    return id !== undefined && id.length > 0 && labelledIds.has(id);
}

function headingLevel(element: HtmlElement): number | undefined {
    if (element.namespace !== 'html' || !/^h[1-6]$/u.test(element.tagName)) {
        return undefined;
    }
    return Number(element.tagName.slice(1));
}

function isSeverity(value: unknown): value is ProblemSeverity {
    return (
        value === 'error' ||
        value === 'warning' ||
        value === 'info' ||
        value === 'hint'
    );
}

function isCompleteDocument(source: string): boolean {
    return /<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(source);
}
