export { createCommentsPlugin } from './comments-plugin.js';
export {
    CommentsController,
    commentsServiceToken,
} from './comments-service.js';
export type {
    CommentAction,
    CommentPermissionContext,
    CommentPermissionProvider,
    CommentsPluginOptions,
    CommentsService,
    CommentStorageAdapter,
} from './comments-service.js';
export { mapCommentThread } from './mapping.js';
export {
    freezeAuthor,
    freezeCommentRange,
    freezeCommentThread,
    freezeCommentThreads,
    normalizeCommentBody,
} from './model.js';
export type {
    CommentAuthor,
    CommentMessage,
    CommentRange,
    CommentThread,
    CommentUnlinkReason,
    DeletedCommentThread,
    LinkedCommentThread,
    ResolvedCommentThread,
    UnlinkedCommentThread,
} from './model.js';
