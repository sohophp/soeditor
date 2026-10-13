import type { ToolbarItemContext, StatusItemInstance } from '@soeditor/ui';

import type { UploadRecord, UploadWorkflowService } from './upload.js';

/** Author feedback stays in editor chrome, never in persisted HTML. */
export function createUploadStatus(
    { document, editor, ui }: ToolbarItemContext,
    workflow: UploadWorkflowService,
): StatusItemInstance {
    const element = document.createElement('div');
    element.setAttribute('data-upload-status', 'true');
    element.style.inlineSize = '100%';
    element.style.maxInlineSize = '100%';
    element.style.display = 'flex';
    element.style.overflowX = 'auto';
    element.style.overflowY = 'hidden';
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
            if (record.status === 'succeeded') {
                const completed = rows.get(record.id);
                if (completed) {
                    const restoreFocus = completed.element.contains(
                        document.activeElement,
                    );
                    completed.element.remove();
                    rows.delete(record.id);
                    if (restoreFocus) ui.restoreEditingSelection();
                }
                continue;
            }
            let row = rows.get(record.id);
            if (!row) {
                const container = document.createElement('div');
                container.setAttribute('data-upload-id', record.id);
                container.style.cssText =
                    'display:flex;align-items:center;gap:.5rem;flex:0 0 100%;min-inline-size:0';
                const message = document.createElement('span');
                message.setAttribute('role', 'status');
                message.style.cssText =
                    'flex:1 1 auto;min-inline-size:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
                const progress = document.createElement('progress');
                progress.style.cssText = 'flex:0 0 5rem;inline-size:5rem';
                progress.setAttribute('aria-label', record.name);
                const action = document.createElement('button');
                action.type = 'button';
                action.className = 'soeditor-ui__button';
                action.style.cssText =
                    'flex:0 0 auto;min-block-size:1.5rem;block-size:1.5rem;padding-block:0';
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
                        message.title = message.textContent;
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
            const processing =
                record.status === 'pending' &&
                record.total !== undefined &&
                record.total > 0 &&
                record.loaded >= record.total;
            const text = `${record.name}: ${ui.translate(processing ? 'Processing image' : messages[record.status])}${record.error ? ` — ${record.error}` : ''}`;
            if (row.message.textContent !== text)
                row.message.textContent = text;
            row.message.title = text;
            row.progress.hidden = record.status !== 'pending';
            if (!processing && record.total && record.total > 0) {
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
