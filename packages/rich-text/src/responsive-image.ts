/** Checks one bounded HTML image attribute supplied by an asset integration. */
export function isBoundedResponsiveImageString(
    value: string,
    maximumLength: number,
): boolean {
    return (
        value.length > 0 &&
        value.length <= maximumLength &&
        !Array.from(value).some((character) => {
            const code = character.codePointAt(0);
            return code !== undefined && (code <= 31 || code === 127);
        })
    );
}

/** Rejects executable schemes in every responsive image URL candidate. */
export function isSafeResponsiveImageSourceSet(value: string): boolean {
    return value.split(',').every((candidate) => {
        const source = candidate.trim().split(/\s+/u, 1)[0];
        return (
            source !== undefined &&
            source.length > 0 &&
            !/^(?:javascript|vbscript|file):/iu.test(source)
        );
    });
}
