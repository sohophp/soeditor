import { createServiceToken } from '@soeditor/core';
import type { Problem } from '@soeditor/html-tools';
import type { SourceRange } from '@soeditor/html';

import type { InspectorElement, OutlineItem } from './analysis.js';

/** UI-independent HTML developer capabilities for one editor instance. */
export interface DeveloperToolsService {
    getInspector(): InspectorElement | undefined;
    getOutline(): readonly OutlineItem[];
    getProblems(): readonly Problem[];
    reveal(range: SourceRange): void;
}

/** Typed identity of an attached HTML developer-tools engine. */
export const developerToolsServiceToken =
    createServiceToken<DeveloperToolsService>('soeditor.developer-tools');
