import type {
    PreviewMediaPlayer,
    PreviewMediaService,
    PreviewMediaSource,
} from './media-service.js';

interface Entry {
    source: HTMLElement;
    readonly description: PreviewMediaSource;
    readonly box: HTMLDivElement;
    player?: PreviewMediaPlayer;
    pending: boolean;
    attempted: boolean;
    removed: boolean;
}

/** Persistent players are siblings of the inert article, never children of it. */
export function createPreviewMedia(
    frame: HTMLIFrameElement,
    service: PreviewMediaService,
): {
    prepare(html: string): string;
    refresh(): void;
    destroy(): void;
} {
    const document = frame.ownerDocument;
    const owner = document.defaultView;
    if (owner === null)
        return {
            prepare: (html) => html,
            refresh: () => {},
            destroy: () => {},
        };
    const layer = document.createElement('div');
    layer.dataset.previewMedia = '';
    // This scroll port also receives native scroll chaining from cross-origin players.
    layer.style.cssText =
        'position:fixed;overflow:auto;scrollbar-width:none;pointer-events:auto;overscroll-behavior:contain';
    const spacer = document.createElement('div');
    spacer.style.cssText = 'width:1px;pointer-events:none';
    layer.append(spacer);
    document.body.append(layer);
    let entries: Entry[] = [];
    let article: Document | null = null;
    let view: Window | null = null;
    let disposed = false;
    let scheduled = 0;
    let scrollTask = 0;
    let scale = 1;
    let left = 0;
    let top = 0;
    let detach = (): void => {};
    let refreshing = false;
    let descriptions = new Map<string, PreviewMediaSource>();
    const release = (entry: Entry): void => {
        entry.removed = true;
        entry.player?.destroy();
        entry.box.remove();
    };
    const activate = async (entry: Entry, explicit = false): Promise<void> => {
        if (
            entry.pending ||
            entry.player !== undefined ||
            entry.removed ||
            (entry.attempted && !explicit)
        )
            return;
        entry.pending = true;
        entry.attempted = true;
        try {
            const player = await entry.description.create(document);
            if (disposed || entry.removed) {
                player.destroy();
                return;
            }
            const focused = entry.box.contains(document.activeElement);
            entry.player = player;
            entry.box.replaceChildren(player.element);
            if (focused)
                player.element
                    .querySelector<HTMLElement>('iframe,video,button')
                    ?.focus();
        } catch {
            // Retain the keyboard-operable placeholder so an import can be retried.
        } finally {
            entry.pending = false;
        }
    };
    const update = (): void => {
        scheduled = 0;
        if (disposed || refreshing || view === null || article === null) return;
        const bounds = frame.getBoundingClientRect();
        scale = frame.offsetWidth > 0 ? bounds.width / frame.offsetWidth : 1;
        left = view.scrollX;
        top = view.scrollY;
        Object.assign(layer.style, {
            zoom: String(1 / scale),
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${frame.clientWidth * scale}px`,
            height: `${frame.clientHeight * scale}px`,
        });
        spacer.style.height = `${article.documentElement.scrollHeight * scale}px`;
        layer.scrollTop = top * scale;
        const hitAreas: string[] = [];
        for (const entry of entries) {
            const rect = entry.source.getBoundingClientRect();
            const visible =
                rect.width > 0 &&
                rect.height > 0 &&
                entry.source.closest('details:not([open]),[hidden]') === null;
            if (visible && rect.bottom > 0 && rect.top < frame.clientHeight) {
                hitAreas.push(
                    `M${rect.left * scale},${rect.top * scale}h${rect.width * scale}v${rect.height * scale}h${-rect.width * scale}Z`,
                );
            }
            Object.assign(entry.box.style, {
                left: `${rect.left * scale}px`,
                top: `${rect.top * scale + layer.scrollTop}px`,
                width: `${rect.width * scale}px`,
                height: `${rect.height * scale}px`,
                display: visible ? 'block' : 'none',
            });
            if (
                visible &&
                rect.bottom > 0 &&
                rect.top < frame.clientHeight &&
                rect.right > 0 &&
                rect.left < frame.clientWidth
            )
                void activate(entry);
        }
        // Only player rectangles intercept input; the rest of the article stays editable
        // by its native links/disclosures. WebKit needs the scroll port itself hittable.
        layer.style.clipPath = `path("${hitAreas.join(' ') || 'M0,0h0v0Z'}")`;
    };
    const schedule = (): void => {
        if (!disposed && !refreshing && scheduled === 0)
            scheduled = owner.requestAnimationFrame(update);
    };
    const watchScroll = (): void => {
        if (disposed) return;
        // WebKit suppresses some script-disabled child events. No layout read at rest.
        if (view !== null && (left !== view.scrollX || top !== view.scrollY))
            schedule();
        scrollTask = owner.requestAnimationFrame(watchScroll);
    };
    scrollTask = owner.requestAnimationFrame(watchScroll);
    const scroll = (): void => {
        if (
            !refreshing &&
            view !== null &&
            Math.abs(layer.scrollTop / scale - top) > 1
        ) {
            view.scrollTo(left, layer.scrollTop / scale);
            schedule();
        }
    };
    layer.addEventListener('scroll', scroll);
    const prepare = (html: string): string => {
        if (!refreshing && view !== null) {
            left = view.scrollX;
            top = view.scrollY;
        }
        refreshing = true;
        detach();
        // Hide, but do not detach, live iframe nodes: detachment destroys playback.
        layer.style.visibility = 'hidden';
        const Parser = (owner as Window & { DOMParser: typeof DOMParser })
            .DOMParser;
        const parsed = new Parser().parseFromString(html, 'text/html');
        descriptions = new Map();
        for (const candidate of Array.from(
            parsed.querySelectorAll('[data-preview-media-id]'),
        ))
            candidate.removeAttribute('data-preview-media-id');
        for (const source of Array.from(
            parsed.querySelectorAll('iframe,video'),
        )) {
            const description = service.resolve(source);
            if (description === undefined) continue;
            const id = String(descriptions.size);
            descriptions.set(id, description);
            source.setAttribute('data-preview-media-id', id);
            source.removeAttribute('src');
            source.removeAttribute('srcdoc');
            source.removeAttribute('autoplay');
            source.setAttribute('preload', 'none');
            for (const child of Array.from(
                source.querySelectorAll('source,track'),
            ))
                child.removeAttribute('src');
        }
        return `<!doctype html>${parsed.documentElement.outerHTML}`;
    };
    const refresh = (): void => {
        if (disposed) return;
        detach();
        article = frame.contentDocument;
        view = article?.defaultView ?? null;
        if (article === null || view === null) {
            layer.style.visibility = 'hidden';
            entries.forEach(release);
            entries = [];
            return;
        }
        const available = new Map<string, Entry[]>();
        for (const entry of entries) {
            const group = available.get(entry.description.key) ?? [];
            group.push(entry);
            available.set(entry.description.key, group);
        }
        const next: Entry[] = [];
        for (const source of Array.from(
            article.querySelectorAll<HTMLIFrameElement | HTMLVideoElement>(
                'iframe,video',
            ),
        )) {
            const description = descriptions.get(
                source.getAttribute('data-preview-media-id') ?? '',
            );
            if (description === undefined) continue;
            let entry = available.get(description.key)?.shift();
            if (entry === undefined) {
                const box = document.createElement('div');
                box.dataset.previewPlayer = '';
                box.style.cssText =
                    'position:absolute;pointer-events:auto;overflow:hidden;background:#101827;color:white';
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = `▶ ${description.title}`;
                button.style.cssText =
                    'width:100%;height:100%;border:0;background:transparent;color:inherit;cursor:pointer';
                if (description.poster !== undefined) {
                    const image = document.createElement('img');
                    image.src = description.poster;
                    image.loading = 'lazy';
                    image.alt = '';
                    image.style.cssText =
                        'display:block;max-width:100%;max-height:75%;margin:auto';
                    button.prepend(image);
                }
                box.append(button);
                layer.append(box);
                const created: Entry = {
                    source,
                    description,
                    box,
                    pending: false,
                    attempted: false,
                    removed: false,
                };
                button.addEventListener('click', () => {
                    void activate(created, true);
                });
                entry = created;
            }
            entry.source = source;
            if (source.localName === 'video') {
                source.removeAttribute('autoplay');
                source.setAttribute('preload', 'none');
            }
            source.removeAttribute('src');
            source.removeAttribute('srcdoc');
            for (const child of Array.from(
                source.querySelectorAll('source,track'),
            ))
                child.removeAttribute('src');
            source.style.visibility = 'hidden';
            source.tabIndex = -1;
            source.setAttribute('aria-hidden', 'true');
            next.push(entry);
        }
        for (const group of available.values()) group.forEach(release);
        entries = next;
        view.scrollTo(left, top);
        refreshing = false;
        layer.style.visibility = 'visible';
        const observer = new ResizeObserver(schedule);
        observer.observe(frame);
        observer.observe(article.documentElement);
        if (article.body !== null) observer.observe(article.body);
        for (const entry of entries) observer.observe(entry.source);
        const childView = view;
        const childDocument = article;
        childView.addEventListener('scroll', schedule, true);
        childDocument.addEventListener('load', schedule, true);
        childDocument.addEventListener('toggle', schedule, true);
        const mutation = new MutationObserver(schedule);
        mutation.observe(childDocument.documentElement, {
            subtree: true,
            attributes: true,
            attributeFilter: ['open', 'style', 'class', 'hidden'],
        });
        detach = () => {
            observer.disconnect();
            mutation.disconnect();
            childView.removeEventListener('scroll', schedule, true);
            childDocument.removeEventListener('load', schedule, true);
            childDocument.removeEventListener('toggle', schedule, true);
        };
        update();
    };
    const destroy = (): void => {
        if (disposed) return;
        disposed = true;
        detach();
        entries.forEach(release);
        entries = [];
        owner.cancelAnimationFrame(scheduled);
        owner.cancelAnimationFrame(scrollTask);
        owner.removeEventListener('resize', schedule);
        owner.removeEventListener('pagehide', destroy);
        layer.removeEventListener('scroll', scroll);
        layer.remove();
    };
    owner.addEventListener('resize', schedule);
    owner.addEventListener('pagehide', destroy, { once: true });
    return { prepare, refresh, destroy };
}
