/** Reports use of an attached UI capability after UI destruction. */
export class EditorUiDestroyedError extends Error {
    constructor() {
        super('Editor UI has been destroyed.');
        this.name = 'EditorUiDestroyedError';
    }
}
