export {
    createVisualEditingEngine,
    VisualEditingEngine,
    VisualEditingEngineDestroyedError,
    UnsupportedVisualDocumentFormatError,
} from './visual-editing-engine.js';
export { HistoryPlugin } from './history.js';
export { groupHistoryTransaction } from './history-metadata.js';
export type {
    EditingEngine,
    VisualEditingEngineOptions,
} from './visual-editing-engine.js';
export type { EditingPoint, EditingSelection } from './model.js';
export { visualEditingServiceToken } from './visual-editing-service.js';
export type {
    VisualBlockTag,
    VisualEditingService,
    VisualLinkAttributes,
    VisualTextMark,
} from './visual-editing-service.js';
