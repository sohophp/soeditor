/** Reports a second classic editor attachment to the same host. */
export class ClassicEditorAlreadyAttachedError extends Error {
    constructor() {
        super('A classic editor is already attached to this host.');
        this.name = 'ClassicEditorAlreadyAttachedError';
    }
}

/** Reports use of a classic editor handle after terminal destruction. */
export class ClassicEditorDestroyedError extends Error {
    constructor() {
        super('The classic editor has been destroyed.');
        this.name = 'ClassicEditorDestroyedError';
    }
}
