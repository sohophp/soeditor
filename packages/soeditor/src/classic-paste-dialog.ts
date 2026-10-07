import type {
    ExternalPastePolicy,
    PasteDecisionService,
} from '@soeditor/engine';
import type { EditorUi } from '@soeditor/ui';

let descriptionId = 0;

export function choosePastePolicy(
    ui: EditorUi,
    request: Parameters<PasteDecisionService['choose']>[0],
): Promise<ExternalPastePolicy | undefined> {
    if (request.signal.aborted || ui.destroyed)
        return Promise.resolve(undefined);
    return new Promise((resolve) => {
        let finished = false;
        const finish = (policy?: ExternalPastePolicy) => {
            if (finished) return;
            finished = true;
            request.signal.removeEventListener('abort', abort);
            handle.element.removeEventListener('close', cancel);
            handle.close();
            resolve(policy);
        };
        const abort = () => finish();
        const cancel = () => finish();
        const office = ['office', 'google-docs', 'libreoffice'].includes(
            request.classification,
        );
        const source = request.classification === 'html-source';
        const handle = ui.dialogs.open({
            title: ui.translate('Choose paste format'),
            content: (container) => {
                const document = container.ownerDocument;
                const intro = document.createElement('p');
                intro.className = 'soeditor-ui__paste-source';
                intro.textContent = ui.translate(
                    source
                        ? 'HTML source detected.'
                        : office
                          ? 'Office document content detected.'
                          : 'Web HTML content detected.',
                );
                container.append(intro);
                const choices = document.createElement('div');
                choices.className = 'soeditor-ui__paste-choices';
                const options: Array<[ExternalPastePolicy, string, string]> = [
                    [
                        'preserve',
                        'Keep formatting',
                        'Keep available styles, images and layout. Useful for designed pages and newsletters. Webpage CSS missing from the clipboard cannot be included.',
                    ],
                    [
                        'semantic',
                        'Clean formatting',
                        'Keep headings, lists, tables, images and links using the editor’s formatting rules. Useful for article content copied from Word or websites.',
                    ],
                    [
                        'plain-text',
                        'Text only',
                        source
                            ? 'Insert the HTML code as visible text, without interpreting its tags.'
                            : 'Insert only text. Remove formatting, images and links; table text may remain without its layout.',
                    ],
                ];
                for (const [policy, label, explanation] of options) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'soeditor-ui__paste-choice';
                    button.setAttribute('aria-label', ui.translate(label));
                    const title = document.createElement('span');
                    title.className = 'soeditor-ui__paste-choice-title';
                    title.textContent = ui.translate(label);
                    const description = document.createElement('span');
                    description.className =
                        'soeditor-ui__paste-choice-description';
                    description.id = `soeditor-paste-description-${++descriptionId}`;
                    description.textContent = ui.translate(explanation);
                    button.setAttribute('aria-describedby', description.id);
                    button.append(title, description);
                    button.addEventListener('click', () => finish(policy));
                    choices.append(button);
                }
                container.append(choices);
                const safety = document.createElement('p');
                safety.className = 'soeditor-ui__paste-safety';
                safety.textContent = ui.translate(
                    'Unsafe scripts and attributes are always filtered.',
                );
                container.append(safety);
            },
        });
        handle.element.classList.add('soeditor-ui__paste-dialog');
        handle.element.addEventListener('close', cancel);
        request.signal.addEventListener('abort', abort, { once: true });
    });
}
