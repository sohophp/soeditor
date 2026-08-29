import { parse, parseFragment } from 'parse5';
import type { ParserError } from 'parse5';

import type { HtmlDocument, HtmlDocumentFragment } from '../nodes.js';
import type {
    HtmlParseDiagnostic,
    HtmlParseResult,
    HtmlParser,
} from '../parser.js';
import { convertDocument, convertDocumentFragment } from './from-parse5.js';
import { convertDiagnosticSource } from './source-location.js';

/** @internal Default parser backed by parse5. */
export class Parse5HtmlParser implements HtmlParser {
    parseDocument(source: string): HtmlParseResult<HtmlDocument> {
        const diagnostics: HtmlParseDiagnostic[] = [];
        const document = parse(source, {
            onParseError: (error) => diagnostics.push(convertDiagnostic(error)),
            sourceCodeLocationInfo: true,
        });

        return Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            document: convertDocument(document),
        });
    }

    parseFragment(source: string): HtmlParseResult<HtmlDocumentFragment> {
        const diagnostics: HtmlParseDiagnostic[] = [];
        const fragment = parseFragment(source, {
            onParseError: (error) => diagnostics.push(convertDiagnostic(error)),
            sourceCodeLocationInfo: true,
        });

        return Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            document: convertDocumentFragment(fragment),
        });
    }
}

function convertDiagnostic(error: ParserError): HtmlParseDiagnostic {
    return Object.freeze({
        code: error.code,
        message: `HTML parse error: ${humanizeCode(error.code)}.`,
        severity: 'error',
        source: convertDiagnosticSource(error),
    });
}

function humanizeCode(code: string): string {
    return code.replaceAll('-', ' ');
}
