import { serialize } from 'parse5';

import type { HtmlDocument, HtmlDocumentFragment } from '../nodes.js';
import type { HtmlSerializer } from '../serializer.js';
import {
    convertToParse5Document,
    convertToParse5Fragment,
} from './to-parse5.js';

/** @internal Default semantic serializer backed by parse5. */
export class Parse5HtmlSerializer implements HtmlSerializer {
    serializeDocument(document: HtmlDocument): string {
        return serialize(convertToParse5Document(document));
    }

    serializeFragment(fragment: HtmlDocumentFragment): string {
        return serialize(convertToParse5Fragment(fragment));
    }
}
