import type { VisualFormatProperty, VisualFormatState } from '@soeditor/engine';

const properties: readonly VisualFormatProperty[] = [
    'alignment',
    'heading',
    'list',
    'font.size',
    'font.family',
    'font.color',
    'font.backgroundColor',
    'font.highlight',
];

/** Read rendered author formatting without changing the selection or persisted HTML. */
export function readFormatStates(
    root: HTMLElement,
    range: Range | undefined,
): Readonly<Record<VisualFormatProperty, VisualFormatState>> {
    const values = new Map<VisualFormatProperty, Set<string>>(
        properties.map((key) => [key, new Set()]),
    );
    const elements = new Set<Element>();
    const add = (node: Node): void => {
        const element =
            node.nodeType === 1 ? (node as Element) : node.parentElement;
        if (element && root.contains(element)) elements.add(element);
    };
    if (
        range &&
        root.contains(range.startContainer) &&
        root.contains(range.endContainer)
    ) {
        if (range.collapsed) add(range.startContainer);
        else {
            const common = range.commonAncestorContainer;
            if (common.nodeType === 3) add(common);
            else {
                const start = range.cloneRange();
                start.collapse(true);
                const end = range.cloneRange();
                end.collapse(false);
                const walker = root.ownerDocument.createTreeWalker(
                    common,
                    NodeFilter.SHOW_TEXT,
                );
                const probe = root.ownerDocument.createRange();
                for (
                    let node = walker.nextNode();
                    node;
                    node = walker.nextNode()
                ) {
                    if (!node.textContent?.length) continue;
                    if (
                        !node.textContent.trim() &&
                        !node.parentElement?.closest(
                            'p,li,h1,h2,h3,h4,h5,h6,td,th',
                        )
                    )
                        continue;
                    probe.selectNodeContents(node);
                    const before = probe.cloneRange();
                    before.collapse(true);
                    probe.collapse(false);
                    if (
                        end.compareBoundaryPoints(
                            Range.START_TO_START,
                            before,
                        ) > 0 &&
                        start.compareBoundaryPoints(
                            Range.START_TO_START,
                            probe,
                        ) < 0
                    )
                        add(node);
                }
            }
        }
    }
    const view = root.ownerDocument.defaultView;
    const styleCache = new Map<Element, CSSStyleDeclaration>();
    const styleFor = (element: Element): CSSStyleDeclaration | undefined => {
        if (!styleCache.has(element) && view)
            styleCache.set(element, view.getComputedStyle(element));
        return styleCache.get(element);
    };
    for (const element of elements) {
        const style = styleFor(element);
        if (!style) continue;
        let alignment = style.textAlign;
        if (alignment === 'start' || alignment === 'end')
            alignment =
                (alignment === 'start') === (style.direction !== 'rtl')
                    ? 'left'
                    : 'right';
        values.get('alignment')?.add(alignment || 'left');
        values
            .get('heading')
            ?.add(
                element
                    .closest('p,h1,h2,h3,h4,h5,h6,pre,div')
                    ?.tagName.toLowerCase() ?? 'p',
            );
        const list = element.closest('ol,ul');
        values
            .get('list')
            ?.add(
                list
                    ? `${list.tagName.toLowerCase()}:${styleFor(list)?.listStyleType ?? ''}`
                    : 'none',
            );
        values.get('font.size')?.add(style.fontSize);
        values.get('font.family')?.add(style.fontFamily);
        values.get('font.color')?.add(style.color);
        let background = 'transparent';
        for (
            let parent: Element | null = element;
            parent && parent !== root && root.contains(parent);
            parent = parent.parentElement
        ) {
            const color = styleFor(parent)?.backgroundColor;
            if (
                color &&
                color !== 'transparent' &&
                color !== 'rgba(0, 0, 0, 0)'
            ) {
                background = color;
                break;
            }
        }
        values.get('font.backgroundColor')?.add(background);
        const mark = element.closest('mark');
        values
            .get('font.highlight')
            ?.add(
                mark
                    ? (styleFor(mark)?.backgroundColor ?? 'transparent')
                    : 'transparent',
            );
    }
    const result = {} as Record<VisualFormatProperty, VisualFormatState>;
    for (const key of properties) {
        const set = values.get(key)!;
        result[key] =
            set.size === 0
                ? { status: 'unavailable' }
                : set.size > 1
                  ? { status: 'mixed' }
                  : { status: 'uniform', value: [...set][0]! };
    }
    return result;
}
