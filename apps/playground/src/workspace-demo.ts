import { Editor } from '@soeditor/core';
import { createVisualEditingEngine } from '@soeditor/engine';
import { minimalPreset } from '@soeditor/presets';
import { createEditorUi } from '@soeditor/ui';
import '@soeditor/ui/styles.css';
import {
    createEditorWorkspace,
    type EditorWorkspace,
} from '@soeditor/workspace';

const editingHost = requiredElement<HTMLElement>('editing');
const toolbarHost = requiredElement<HTMLElement>('toolbar');
const sourceOutput = requiredElement<HTMLOutputElement>('source');
const statusOutput = requiredElement<HTMLElement>('status');
const parameters = new URLSearchParams(globalThis.location.search);
const controlled = parameters.get('controlled') === '1';
let changeCount = 0;
let createCount = 0;

const workspace: EditorWorkspace = await createEditorWorkspace({
    attachments: [
        {
            id: 'visual',
            attach: ({ editor }) =>
                createVisualEditingEngine({ editor, element: editingHost }),
        },
        {
            id: 'ui',
            attach: ({ editor }) =>
                createEditorUi({
                    editor,
                    element: toolbarHost,
                    toolbar: minimalPreset.toolbar,
                }),
        },
    ],
    createEditor: ({ source }) => {
        createCount += 1;
        return Editor.create({
            data: source,
            format: minimalPreset.format,
            plugins: minimalPreset.plugins,
        });
    },
    recovery: { maxRestarts: 2, windowMs: 60_000 },
    value: controlled
        ? {
              kind: 'controlled',
              onChange: ({ source }) => {
                  changeCount += 1;
                  workspace?.setValue(source);
                  render();
              },
              value: '<p>Workspace initial</p>',
          }
        : {
              initialValue: '<p>Workspace initial</p>',
              kind: 'uncontrolled',
              onChange: () => {
                  changeCount += 1;
                  render();
              },
          },
});
workspace.subscribe(render);
render();
document.body.dataset.ready = 'true';

Reflect.set(
    globalThis,
    '__workspaceDemo',
    Object.freeze({
        crash: async (): Promise<string> => {
            try {
                await workspace?.reportFailure(new Error('Demo surface crash'));
            } catch {
                // The snapshot is the observable terminal result.
            }
            render();
            return workspace?.snapshot.status ?? 'destroyed';
        },
        destroy: async (): Promise<{
            readonly editingChildren: number;
            readonly status: string;
            readonly toolbarChildren: number;
        }> => {
            await workspace?.destroy();
            render();
            return Object.freeze({
                editingChildren: editingHost.childNodes.length,
                status: workspace?.snapshot.status ?? 'destroyed',
                toolbarChildren: toolbarHost.childNodes.length,
            });
        },
        setValue: (source: string): void => workspace?.setValue(source),
        snapshot: () =>
            Object.freeze({
                changeCount,
                createCount,
                diagnostics: workspace?.snapshot.diagnostics.map(
                    ({ code }) => code,
                ),
                editingChildren: editingHost.childNodes.length,
                source: workspace?.snapshot.lastKnownSource,
                status: workspace?.snapshot.status,
                toolbarChildren: toolbarHost.childNodes.length,
                ...(workspace?.snapshot.error === undefined
                    ? {}
                    : { error: String(workspace.snapshot.error) }),
                recoveryCount: workspace?.snapshot.recoveryCount,
            }),
    }),
);

function render(): void {
    if (workspace === undefined) return;
    const snapshot = workspace.snapshot;
    sourceOutput.value = snapshot.lastKnownSource;
    statusOutput.textContent = `${snapshot.status}; recovery ${String(snapshot.recoveryCount)}`;
    document.body.dataset.workspaceStatus = snapshot.status;
}

function requiredElement<ElementType extends HTMLElement>(
    id: string,
): ElementType {
    const element = document.querySelector<ElementType>(`#${id}`);
    if (element === null) throw new Error(`Workspace demo requires #${id}.`);
    return element;
}
