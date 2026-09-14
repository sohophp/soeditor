/** Instance-owned URL projection; canonical attributes remain relative. */
export class BaseHrefProjection {
    readonly #base: string | undefined;
    readonly #values = new WeakMap<
        Element,
        Map<string, { source: string; projected: string }>
    >();

    constructor(value: string | undefined, document: Document) {
        if (value === undefined) return;
        const url = new URL(value, document.baseURI);
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new TypeError('baseHref must use HTTP or HTTPS.');
        }
        this.#base = url.href;
    }

    applyTree(root: Element): void {
        if (this.#base === undefined) return;
        for (const element of Array.from(root.querySelectorAll('*')))
            this.apply(element);
    }

    apply(element: Element): void {
        if (this.#base === undefined) return;
        for (const attribute of Array.from(element.attributes)) {
            const previous = this.#values.get(element)?.get(attribute.name);
            if (previous?.projected === attribute.value) continue;
            const source = this.source(
                element,
                attribute.name,
                attribute.value,
            );
            const projected = this.#project(attribute.name, source);
            if (projected === source) continue;
            let values = this.#values.get(element);
            if (values === undefined) {
                values = new Map();
                this.#values.set(element, values);
            }
            values.set(attribute.name, { source, projected });
            element.setAttribute(attribute.name, projected);
        }
    }

    source(element: Element, name: string, value: string): string {
        const entry = this.#values.get(element)?.get(name);
        if (entry?.projected === value) return entry.source;
        if (entry !== undefined && name === 'style') {
            const original = element.ownerDocument.createElement('span').style;
            const projected = element.ownerDocument.createElement('span').style;
            const current = element.ownerDocument.createElement('span').style;
            original.cssText = entry.source;
            projected.cssText = entry.projected;
            current.cssText = value;
            for (let index = 0; index < original.length; index += 1) {
                const property = original.item(index);
                if (
                    current.getPropertyValue(property) ===
                    projected.getPropertyValue(property)
                ) {
                    current.setProperty(
                        property,
                        original.getPropertyValue(property),
                        current.getPropertyPriority(property),
                    );
                }
            }
            return current.cssText;
        }
        return value;
    }

    copy(source: Element, target: Element): void {
        const values = this.#values.get(source);
        if (values !== undefined) this.#values.set(target, new Map(values));
    }

    #url(value: string): string {
        if (
            !value.trim() ||
            value.startsWith('#') ||
            /^[a-z][a-z0-9+.-]*:/iu.test(value)
        )
            return value;
        try {
            return new URL(value, this.#base).href;
        } catch {
            return value;
        }
    }

    #project(name: string, value: string): string {
        if (['src', 'href', 'poster', 'background', 'cite'].includes(name))
            return this.#url(value);
        if (name === 'srcset') {
            let result = '';
            let cursor = 0;
            while (cursor < value.length) {
                const prefix = /^[\s,]*/u.exec(value.slice(cursor))?.[0] ?? '';
                result += prefix;
                cursor += prefix.length;
                const token = /^\S+/u.exec(value.slice(cursor))?.[0] ?? '';
                if (token === '') break;
                cursor += token.length;
                const url = token.replace(/,+$/u, '');
                result += this.#url(url) + token.slice(url.length);
                if (url.length !== token.length) continue;
                const end = value.indexOf(',', cursor);
                const next = end < 0 ? value.length : end + 1;
                result += value.slice(cursor, next);
                cursor = next;
            }
            return result;
        }
        if (name === 'style') {
            return value.replace(
                /url\(\s*(['"]?)([^'"()]+)\1\s*\)/giu,
                (_match: string, _quote: string, url: string) =>
                    `url("${this.#url(url.trim()).replaceAll('"', '%22')}")`,
            );
        }
        return value;
    }
}
