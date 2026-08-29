export { compareRevisionSources } from './comparison.js';
export type {
    RevisionChange,
    RevisionChangeKind,
    RevisionComparison,
} from './comparison.js';
export {
    createRevisionSaveInput,
    freezeRevisionAuthor,
    freezeRevisionList,
    freezeRevisionMetadata,
    freezeRevisionSnapshot,
    validateReviewPolicy,
} from './model.js';
export { revisionsServiceToken } from './revisions-service.js';
export { createRevisionsPlugin } from './revisions-plugin.js';
export type {
    RevisionAction,
    RevisionPermissionContext,
    RevisionPermissionProvider,
    RevisionsPluginOptions,
    RevisionsService,
    RevisionsSnapshot,
} from './revisions-service.js';
export type {
    ReviewPolicy,
    RevisionAuthor,
    RevisionKind,
    RevisionMetadata,
    RevisionProvider,
    RevisionSaveInput,
    RevisionSnapshot,
    RevisionStorage,
} from './model.js';
