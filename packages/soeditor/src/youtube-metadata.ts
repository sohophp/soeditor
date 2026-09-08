import { mediaUrl, youtubeId } from './video-policy.js';
import type { CmsVideoOptions } from './video.js';

type Field = HTMLInputElement | HTMLSelectElement;

/** Form-only enrichment. Never imports or executes the provider's embed HTML. */
export function attachYoutubeMetadata(
    source: Field,
    fields: Readonly<{ title: Field; poster: Field; ratio: Field }>,
    status: HTMLElement,
    options: CmsVideoOptions,
    existing: boolean,
    active: () => boolean,
    translate: (en: string, zh: string) => string,
): () => void {
    const baseline = new Map<Field, string>();
    const automatic = new Map<Field, string>();
    const manual = new Set<Field>();
    const listeners: Array<() => void> = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let sequence = 0;
    let lastKey: string | undefined;
    let disposed = false;
    for (const field of Object.values(fields)) {
        baseline.set(field, field.value);
        if (field.value !== '' && (field !== fields.ratio || existing))
            manual.add(field);
        const edited = (): void => {
            manual.add(field);
            automatic.delete(field);
        };
        field.addEventListener('input', edited);
        listeners.push(() => field.removeEventListener('input', edited));
    }
    const put = (field: Field, value: string): void => {
        if (manual.has(field)) return;
        field.value = value;
        automatic.set(field, value);
    };
    const cancel = (): void => {
        ++sequence;
        clearTimeout(timer);
        clearTimeout(timeout);
        controller?.abort();
    };
    const changed = (): void => {
        const id = youtubeId(source.value.trim());
        const shorts =
            id !== undefined &&
            new URL(source.value.trim()).pathname.startsWith('/shorts/');
        const key = id === undefined ? undefined : `${id}:${String(shorts)}`;
        if (key !== undefined && key === lastKey) return;
        lastKey = key;
        cancel();
        status.textContent = '';
        for (const [field, value] of automatic)
            if (!manual.has(field) && field.value === value)
                field.value = baseline.get(field) ?? '';
        automatic.clear();
        if (
            id === undefined ||
            options.youtube === false ||
            options.youtubeMetadata === false
        )
            return;
        put(fields.ratio, shorts ? '9:16' : '16:9');
        const current = sequence;
        status.textContent = translate(
            'Loading video details…',
            '正在获取视频信息…',
        );
        timer = setTimeout(() => {
            const request = new AbortController();
            controller = request;
            timeout = setTimeout(() => request.abort(), 5000);
            const url = new URL('https://www.youtube.com/oembed');
            url.searchParams.set(
                'url',
                `https://www.youtube.com/watch?v=${id}`,
            );
            url.searchParams.set('format', 'json');
            void fetch(url, {
                signal: request.signal,
                credentials: 'omit',
                redirect: 'error',
            })
                .then(async (response): Promise<unknown> => {
                    if (!response.ok) throw new Error('Metadata unavailable');
                    return response.json();
                })
                .then((value) => {
                    if (disposed || !active() || current !== sequence) return;
                    if (
                        typeof value !== 'object' ||
                        value === null ||
                        Reflect.get(value, 'type') !== 'video'
                    )
                        throw new Error('Invalid video metadata');
                    let filled = false;
                    const title: unknown = Reflect.get(value, 'title');
                    if (typeof title === 'string' && title.trim()) {
                        put(fields.title, title.trim().slice(0, 500));
                        filled = true;
                    }
                    const thumbnail: unknown = Reflect.get(
                        value,
                        'thumbnail_url',
                    );
                    if (typeof thumbnail === 'string') {
                        try {
                            const image = new URL(thumbnail);
                            if (
                                image.protocol === 'https:' &&
                                image.hostname === 'i.ytimg.com' &&
                                image.pathname.startsWith(`/vi/${id}/`)
                            ) {
                                put(
                                    fields.poster,
                                    mediaUrl(
                                        thumbnail,
                                        source.ownerDocument.baseURI,
                                        options,
                                    ),
                                );
                                filled = true;
                            }
                        } catch {
                            /* Preserve the configured asset origin policy. */
                        }
                    }
                    status.textContent = filled
                        ? translate(
                              'Video details loaded. Your edits are preserved.',
                              '视频信息已获取，已保留手动填写的内容。',
                          )
                        : translate(
                              'No video details available. You can enter them manually.',
                              '未获取到视频信息，可以手动填写。',
                          );
                })
                .catch(() => {
                    if (!disposed && active() && current === sequence)
                        status.textContent = translate(
                            'Could not load video details. You can still insert the video.',
                            '暂时无法获取视频信息，仍可手动填写并插入视频。',
                        );
                })
                .finally(() => {
                    if (current === sequence) clearTimeout(timeout);
                });
        }, 350);
    };
    source.addEventListener('input', changed);
    return () => {
        disposed = true;
        cancel();
        source.removeEventListener('input', changed);
        for (const dispose of listeners) dispose();
    };
}
