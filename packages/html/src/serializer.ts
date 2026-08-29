import type { HtmlDocument, HtmlDocumentFragment } from './nodes.js';

/** Semantic serializer for SoEditor-owned HTML trees. */
export interface HtmlSerializer {
    serializeDocument(document: HtmlDocument): string;
    serializeFragment(fragment: HtmlDocumentFragment): string;
}
