import type { ParserError } from 'parse5';

import type {
    ElementSourceRange,
    SourcePosition,
    SourceRange,
} from '../source-location.js';

interface Parse5Location {
    readonly startLine: number;
    readonly startCol: number;
    readonly startOffset: number;
    readonly endLine: number;
    readonly endCol: number;
    readonly endOffset: number;
}

interface Parse5ElementLocation extends Parse5Location {
    readonly startTag?: Parse5Location;
    readonly endTag?: Parse5Location;
    readonly attrs?: Readonly<Record<string, Parse5Location>>;
}

function createPosition(
    line: number,
    column: number,
    offset: number,
): SourcePosition {
    return Object.freeze({ column, line, offset });
}

/** @internal Converts a parse5 half-open location into a public source range. */
export function convertSourceRange(location: Parse5Location): SourceRange {
    return Object.freeze({
        end: createPosition(
            location.endLine,
            location.endCol,
            location.endOffset,
        ),
        start: createPosition(
            location.startLine,
            location.startCol,
            location.startOffset,
        ),
    });
}

/** @internal Converts element-specific source spans without exposing parse5. */
export function convertElementSourceRange(
    location: Parse5ElementLocation,
): ElementSourceRange {
    return Object.freeze({
        ...convertSourceRange(location),
        ...(location.endTag === undefined
            ? {}
            : { endTag: convertSourceRange(location.endTag) }),
        ...(location.startTag === undefined
            ? {}
            : { startTag: convertSourceRange(location.startTag) }),
    });
}

/** @internal Looks up an attribute span by qualified or local name. */
export function findAttributeSourceRange(
    location: Parse5ElementLocation | null | undefined,
    name: string,
    prefix: string | undefined,
): SourceRange | undefined {
    const ranges = location?.attrs;

    if (ranges === undefined) {
        return undefined;
    }

    const qualifiedName = prefix === undefined ? name : `${prefix}:${name}`;
    const range = ranges[qualifiedName] ?? ranges[name];
    return range === undefined ? undefined : convertSourceRange(range);
}

/** @internal Parser errors use the same location coordinate convention. */
export function convertDiagnosticSource(error: ParserError): SourceRange {
    return convertSourceRange(error);
}
