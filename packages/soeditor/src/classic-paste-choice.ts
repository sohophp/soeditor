import { pasteDecisionServiceToken } from '@soeditor/engine';
import type { PasteDecisionService } from '@soeditor/engine';
import type { Editor } from '@soeditor/core';
import type { EditorUi } from '@soeditor/ui';

/** Opt-in Classic prompt; the dialog module loads only for external rich paste. */
export function attachClassicPasteChoice(
    editor: Editor,
    ui: EditorUi,
): () => void {
    const configured = editor.config.get<unknown>('cms.paste.prompt');
    if (configured !== undefined && typeof configured !== 'boolean') {
        throw new TypeError('cms.paste.prompt must be a boolean.');
    }
    if (configured !== true) return () => undefined;
    let destroyed = false;
    const service = {
        async choose(request: Parameters<PasteDecisionService['choose']>[0]) {
            const module = await import('./classic-paste-dialog.js');
            if (destroyed || request.signal.aborted) return undefined;
            return module.choosePastePolicy(ui, request);
        },
    };
    editor.services.register(pasteDecisionServiceToken, service);
    return () => {
        destroyed = true;
        if (editor.services.tryGet(pasteDecisionServiceToken) === service)
            editor.services.unregister(pasteDecisionServiceToken);
    };
}
