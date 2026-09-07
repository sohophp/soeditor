import type { ToolbarItemContext, StatusItemInstance } from '@soeditor/ui';

import type { UploadRecord, UploadWorkflowService } from './upload.js';

/** Author feedback stays in editor chrome, never in persisted HTML. */
export function createUploadStatus(
    { document, editor, ui }: ToolbarItemContext,
    workflow: UploadWorkflowService,
): StatusItemInstance {
    const element = document.createElement('div');
    element.setAttribute('data-upload-status', 'true');
    element.style.maxInlineSize = 'min(24rem, 70vw)';
    element.style.maxBlockSize = '10rem';
    element.style.overflow = 'auto';
    const dismissed = new Set<string>();
    const rows = new Map<
        string,
        {
            element: HTMLElement;
            message: HTMLElement;
            progress: HTMLProgressElement;
            action: HTMLButtonElement;
            record: UploadRecord;
        }
    >();
    const messages = {
        pending: 'Uploading',
        failed: 'Upload failed',
        succeeded: 'Upload complete',
        cancelled: 'Upload cancelled',
    };
    const render = (records: readonly UploadRecord[]): void => {
        for (const record of records) {
            if (dismissed.has(record.id)) continue;
            let row = rows.get(record.id);
            if (!row) {
                const container = document.createElement('div');
                container.setAttribute('data-upload-id', record.id);
                container.style.cssText =
                    'display:flex;flex-wrap:wrap;align-items:center;gap:.25rem;overflow-wrap:anywhere';
                const message = document.createElement('span');
                message.setAttribute('role', 'status');
                const progress = document.createElement('progress');
                progress.style.inlineSize = '5rem';
                progress.setAttribute('aria-label', record.name);
                const action = document.createElement('button');
                action.type = 'button';
                action.className = 'soeditor-ui__button';
                row = { element: container, message, progress, action, record };
                const owned = row;
                action.addEventListener('click', () => {
                    const current = owned.record;
                    if (
                        current.status === 'succeeded' ||
                        current.status === 'cancelled'
                    ) {
                        dismissed.add(current.id);
                        container.remove();
                        rows.delete(current.id);
                        element.hidden = rows.size === 0;
                        ui.restoreEditingSelection();
                        return;
                    }
                    const command =
                        current.status === 'pending'
                            ? 'image.upload.cancel'
                            : 'image.upload.retry';
                    const showError = (error: unknown): void => {
                        message.textContent = `${current.name}: ${ui.translate('Upload failed')} — ${error instanceof Error ? error.message : String(error)}`;
                    };
                    try {
                        const result = editor.execute(command, current.id);
                        void Promise.resolve(result).catch(showError);
                    } catch (error: unknown) {
                        showError(error);
                    }
                });
                container.append(message, progress, action);
                element.append(container);
                rows.set(record.id, row);
            }
            row.record = record;
            row.action.disabled =
                record.status === 'failed' &&
                !editor.commands.canExecute('image.upload.retry');
            row.element.setAttribute('data-upload-state', record.status);
            const text = `${record.name}: ${ui.translate(messages[record.status])}${record.error ? ` — ${record.error}` : ''}`;
            if (row.message.textContent !== text)
                row.message.textContent = text;
            row.progress.hidden = record.status !== 'pending';
            if (record.total && record.total > 0) {
                row.progress.max = record.total;
                row.progress.value = record.loaded;
            } else row.progress.removeAttribute('value');
            const label = ui.translate(
                record.status === 'pending'
                    ? 'Cancel'
                    : record.status === 'failed'
                      ? 'Retry'
                      : 'Close',
            );
            if (row.action.textContent !== label)
                row.action.textContent = label;
            row.action.setAttribute('aria-label', `${label}: ${record.name}`);
        }
        element.hidden = rows.size === 0;
    };
    const unsubscribe = workflow.subscribe(render);
    return {
        element,
        update: () => render(workflow.list()),
        destroy: unsubscribe,
    };
}
