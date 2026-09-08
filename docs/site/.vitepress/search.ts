// This function is serialized by VitePress and must not capture module state.
export function tokenize(text: string): string[] {
    const normalized = text.normalize('NFKC').toLowerCase();
    const fallback =
        normalized.match(/[\p{Script=Han}]|[\p{L}\p{N}_]+/gu) ?? [];
    if (typeof Intl.Segmenter !== 'function') return fallback;
    const segments = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    return [
        ...new Set([
            ...fallback,
            ...Array.from(segments.segment(normalized))
                .filter((part) => part.isWordLike)
                .map((part) => part.segment),
        ]),
    ];
}
