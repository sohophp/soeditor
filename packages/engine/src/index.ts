/**
 * Minimal lifecycle boundary reserved for a future editing engine.
 *
 * Phase 1 intentionally provides no DOM or contenteditable implementation.
 */
export interface EditingEngine {
    /** Releases all resources owned by the future engine implementation. */
    destroy(): void;
}
