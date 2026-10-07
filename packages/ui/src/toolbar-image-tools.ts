import { createToolbarRoot } from './toolbar-root.js';

import type { EditorUi, ToolbarItemFactory } from './types.js';
import { field, canExecute, execute } from './toolbar-tool-shared.js';

const imageActionsMenu: ToolbarItemFactory = ({ document, editor, ui }) => {
    const details = createToolbarRoot(document, ui, 'details');
    details.className = 'soeditor-ui__menu soeditor-ui__image-menu';
    const summary = document.createElement('summary');
    summary.className = 'soeditor-ui__button';
    ui.setIcon(summary, 'image.actions', 'Insert image');
    summary.title = 'Insert image';
    summary.setAttribute('aria-label', 'Choose image insertion method');
    const menu = document.createElement('div');
    menu.className = 'soeditor-ui__menu-items';
    menu.setAttribute('role', 'menu');
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'image/*';
    uploadInput.hidden = true;
    const upload = imageAction(
        document,
        ui,
        'image.upload',
        'Upload from computer',
    );
    const browse = imageAction(
        document,
        ui,
        'image.browse',
        'Insert with file manager',
    );
    const url = imageAction(document, ui, 'image.insert', 'Insert via URL');
    const close = (): void => {
        details.open = false;
    };
    const uploadClick = (): void => {
        close();
        uploadInput.click();
    };
    const uploadChange = (): void => {
        const file = uploadInput.files?.item(0);
        uploadInput.value = '';
        if (file === null || file === undefined) return;
        close();
        execute(editor, ui, 'image.upload', [
            { file, name: file.name, type: file.type },
        ]);
    };
    const browseClick = (): void => {
        close();
        execute(editor, ui, 'image.browse', []);
    };
    const urlClick = (): void => {
        close();
        let source: HTMLInputElement;
        let alternative: HTMLInputElement;
        const handle = ui.dialogs.open({
            title: 'Insert image via URL',
            content: (container) => {
                container
                    .closest('.soeditor-ui__dialog')
                    ?.classList.add('soeditor-ui__image-dialog');
                source = field(document, container, 'Image URL', 'url', true);
                alternative = field(
                    document,
                    container,
                    'Alternative text',
                    'text',
                );
            },
            actions: [
                {
                    kind: 'primary',
                    label: 'Insert image',
                    run: () => {
                        if (
                            execute(editor, ui, 'image.insert', [
                                {
                                    alt: alternative.value,
                                    src: source.value,
                                },
                            ])
                        ) {
                            handle.close();
                        }
                    },
                },
            ],
        });
    };
    upload.addEventListener('click', uploadClick);
    uploadInput.addEventListener('change', uploadChange);
    browse.addEventListener('click', browseClick);
    url.addEventListener('click', urlClick);
    menu.append(upload, browse, url, uploadInput);
    details.append(summary, menu);
    return {
        element: details,
        update: () => {
            const uploadAvailable = canExecute(editor, 'image.upload');
            const browseAvailable = canExecute(editor, 'image.browse');
            const urlAvailable = canExecute(editor, 'image.insert');
            upload.disabled = !uploadAvailable;
            browse.disabled = !browseAvailable;
            url.disabled = !urlAvailable;
            summary.setAttribute(
                'aria-disabled',
                String(!uploadAvailable && !browseAvailable && !urlAvailable),
            );
        },
        destroy: () => {
            upload.removeEventListener('click', uploadClick);
            uploadInput.removeEventListener('change', uploadChange);
            browse.removeEventListener('click', browseClick);
            url.removeEventListener('click', urlClick);
        },
    };
};

function imageAction(
    document: Document,
    ui: EditorUi,
    icon: string,
    label: string,
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__menu-item';
    button.setAttribute('role', 'menuitem');
    ui.setIcon(button, icon, label);
    const text = document.createElement('span');
    text.textContent = label;
    button.append(text);
    return button;
}

export { imageActionsMenu };
