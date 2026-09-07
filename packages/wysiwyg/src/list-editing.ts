/** DOM-only list transforms. The engine owns selection restoration and transactions. */
export function selectedListBlocks(
    root: HTMLElement,
    range: Range,
): HTMLElement[] {
    const blocks = new Set<HTMLElement>();
    const add = (node: Node): void => {
        const element =
            node.nodeType === 1 ? (node as Element) : node.parentElement;
        const block =
            element?.closest<HTMLElement>('li') ??
            element?.closest<HTMLElement>(
                'p,h1,h2,h3,h4,h5,h6,pre,blockquote,div,td,th,figcaption',
            );
        if (block && block !== root && root.contains(block)) blocks.add(block);
    };
    if (range.collapsed) add(range.startContainer);
    else {
        const start = range.cloneRange();
        start.collapse(true);
        const end = range.cloneRange();
        end.collapse(false);
        const probe = root.ownerDocument.createRange();
        const walker = root.ownerDocument.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (
                node.nodeType !== 3 &&
                !(node instanceof Element && node.matches('br,img,hr'))
            )
                continue;
            if (node.nodeType === 3) probe.selectNodeContents(node);
            else probe.selectNode(node);
            const before = probe.cloneRange();
            before.collapse(true);
            probe.collapse(false);
            if (
                end.compareBoundaryPoints(Range.START_TO_START, before) > 0 &&
                start.compareBoundaryPoints(Range.START_TO_START, probe) < 0
            )
                add(node);
        }
    }
    return [...blocks].filter(
        (block) =>
            ![...blocks].some(
                (other) => other !== block && other.contains(block),
            ),
    );
}

function listNumbers(list: HTMLElement): Map<Element, number> {
    const items = Array.from(list.children).filter(
        (item) => item.tagName === 'LI',
    );
    const reversed = list.hasAttribute('reversed');
    let value = Number.parseInt(list.getAttribute('start') ?? '', 10);
    if (!Number.isFinite(value)) value = reversed ? items.length : 1;
    const numbers = new Map<Element, number>();
    for (const item of items) {
        const explicit = Number.parseInt(item.getAttribute('value') ?? '', 10);
        if (Number.isFinite(explicit)) value = explicit;
        numbers.set(item, value);
        value += reversed ? -1 : 1;
    }
    return numbers;
}

/** Split only selected runs; keep numbering and one owner for source IDs. */
function transformList(
    list: HTMLElement,
    selected: Set<HTMLElement>,
    target: 'ol' | 'ul' | undefined,
): void {
    const document = list.ownerDocument;
    const numbers = listNumbers(list);
    const fragment = document.createDocumentFragment();
    let run: HTMLElement | undefined;
    let previousSelected: boolean | undefined;
    let identityUsed = false;
    for (const node of Array.from(list.childNodes)) {
        if (!(node instanceof HTMLElement) || node.tagName !== 'LI') {
            (run ?? fragment).append(node);
            continue;
        }
        const active = selected.has(node);
        if (active && target === undefined) {
            const block = document.createElement('div');
            for (const attribute of Array.from(node.attributes)) {
                if (attribute.name !== 'value')
                    block.setAttribute(attribute.name, attribute.value);
            }
            block.append(...Array.from(node.childNodes));
            fragment.append(block);
            run = undefined;
        } else {
            const tag = active ? target! : list.tagName.toLowerCase();
            if (run === undefined || previousSelected !== active) {
                run = document.createElement(tag);
                for (const attribute of Array.from(list.attributes)) {
                    if (attribute.name === 'id' && identityUsed) continue;
                    if (
                        tag !== list.tagName.toLowerCase() &&
                        ['type', 'start', 'reversed'].includes(attribute.name)
                    )
                        continue;
                    run.setAttribute(attribute.name, attribute.value);
                }
                identityUsed = true;
                if (tag !== list.tagName.toLowerCase())
                    run.style.removeProperty('list-style-type');
                if (tag === 'ol' && list.tagName === 'OL')
                    run.setAttribute('start', String(numbers.get(node) ?? 1));
                fragment.append(run);
            }
            run.append(node);
        }
        previousSelected = active;
    }
    list.replaceWith(fragment);
}

export function toggleSelectedList(
    root: HTMLElement,
    range: Range,
    target: 'ol' | 'ul',
): void {
    const blocks = selectedListBlocks(root, range);
    const remove =
        blocks.length > 0 &&
        blocks.every(
            (block) =>
                block.tagName === 'LI' &&
                block.parentElement?.tagName.toLowerCase() === target,
        );
    const lists = new Map<HTMLElement, Set<HTMLElement>>();
    for (const block of blocks) {
        const parent = block.parentElement;
        if (block.tagName === 'LI' && parent?.matches('ol,ul')) {
            const items = lists.get(parent) ?? new Set<HTMLElement>();
            items.add(block);
            lists.set(parent, items);
        }
    }
    for (const [list, items] of lists) {
        if (!remove && list.tagName.toLowerCase() === target) continue;
        transformList(list, items, remove ? undefined : target);
    }
    let run: HTMLElement | undefined;
    for (const block of blocks) {
        if (block.tagName === 'LI' || !block.isConnected) {
            run = undefined;
            continue;
        }
        const item = root.ownerDocument.createElement('li');
        if (block.matches('td,th,figcaption')) {
            const container = root.ownerDocument.createElement(target);
            item.append(...Array.from(block.childNodes));
            container.append(item);
            block.append(container);
            run = undefined;
        } else {
            if (run === undefined || run.nextSibling !== block) {
                run = root.ownerDocument.createElement(target);
                block.before(run);
            }
            item.append(block);
            run.append(item);
        }
    }
}

export function indentSelectedList(
    root: HTMLElement,
    range: Range,
    delta: -1 | 1,
): boolean {
    const items = selectedListBlocks(root, range);
    if (items.length === 0 || items.some((item) => item.tagName !== 'LI'))
        return false;
    for (const item of delta > 0 ? items : [...items].reverse()) {
        const list = item.parentElement;
        if (list === null) continue;
        if (delta > 0) {
            const previous = item.previousElementSibling;
            if (!(previous instanceof HTMLElement) || previous.tagName !== 'LI')
                continue;
            let nested = previous.lastElementChild;
            if (
                !(nested instanceof HTMLElement) ||
                nested.tagName !== list.tagName
            ) {
                nested = list.cloneNode(false) as HTMLElement;
                nested.removeAttribute('id');
                nested.removeAttribute('start');
                nested.removeAttribute('reversed');
                previous.append(nested);
            }
            nested.append(item);
        } else {
            const parentItem = list.parentElement;
            if (parentItem?.tagName !== 'LI') {
                transformList(list, new Set([item]), undefined);
                continue;
            }
            if (item.nextSibling !== null) {
                const tail = list.cloneNode(false) as HTMLElement;
                tail.removeAttribute('id');
                if (list.tagName === 'OL') {
                    const next = item.nextElementSibling;
                    if (next !== null)
                        tail.setAttribute(
                            'start',
                            String(listNumbers(list).get(next) ?? 1),
                        );
                }
                while (item.nextSibling !== null) tail.append(item.nextSibling);
                item.append(tail);
            }
            parentItem.after(item);
            if (!list.querySelector(':scope > li')) list.remove();
        }
    }
    return true;
}
