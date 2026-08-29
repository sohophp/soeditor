export {
    createVisualEditingEngine,
    VisualEditingEngine,
    VisualEditingEngineDestroyedError,
    UnsupportedVisualDocumentFormatError,
} from './visual-editing-engine.js';
export { HistoryPlugin } from './history.js';
export { groupHistoryTransaction } from './history-metadata.js';
export { mapEditingPoint, readEditingOperations } from './operations.js';
export type {
    EditingOperation,
    EditingPointAffinity,
    EditingResult,
} from './operations.js';
export type {
    EditingEngine,
    VisualEditingEngineOptions,
} from './visual-editing-engine.js';
export type { EditingPoint, EditingSelection } from './model.js';
export type {
    EditingBlock,
    EditingBlockTag,
    EditingInline,
    EditingLinkMark,
    EditingMark,
    EditingModel,
    EditingOpaqueBlock,
    EditingOpaqueInline,
    EditingParagraph,
    EditingStructuredBlock,
    EditingTextMark,
    EditingTextRun,
} from './model.js';
export {
    StructuredEditingContributionAlreadyRegisteredError,
    StructuredEditingContributionConflictError,
    StructuredEditingPlugin,
    StructuredEditingRegistrySealedError,
    structuredEditingRegistryToken,
} from './structured-editing.js';
export type {
    StructuredBlockBehavior,
    StructuredBlockConversion,
    StructuredEditingRegistry,
} from './structured-editing.js';
export { visualEditingServiceToken } from './visual-editing-service.js';
export type {
    VisualBlockTag,
    VisualEditingService,
    VisualLinkAttributes,
    VisualTextMark,
} from './visual-editing-service.js';
