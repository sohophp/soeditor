export {
    createSourceEditingEngine,
    SourceEditingEngine,
    SourceEditingEngineDestroyedError,
    UnsupportedSourceDocumentFormatError,
} from './source-editing-engine.js';
export type {
    SourceEditingEngineOptions,
    SourceEngine,
} from './source-editing-engine.js';
export { SourceEditingPlugin } from './source-editing-plugin.js';
export { sourceEditingServiceToken } from './source-editing-service.js';
export type {
    SourceEditingService,
    SourceRevealOptions,
} from './source-editing-service.js';
export { sourceRangeForEditingSelection } from './source-mapping.js';
export { attachClassicSourceEnhancements } from './classic-source-enhancements.js';
export type { ClassicSourceEnhancementOptions } from './classic-source-enhancements.js';
