import type { Editor } from '@soeditor/core';
import type { DismissibleUiHandle, EditorUi } from '@soeditor/ui';

export function attachClassicLinkContext(
    editor: Editor,
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    const document = visual.ownerDocument;
    let balloon: DismissibleUiHandle | undefined;
    let activeLink: HTMLAnchorElement | undefined;
    const close = (): void => {
        balloon?.close();
        balloon = undefined;
        activeLink = undefined;
    };
    const selectLink = (link: HTMLAnchorElement): void => {
        const focusTarget =
            link.closest<HTMLElement>('.soeditor-table-cell') ?? visual;
        focusTarget.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(link);
        const selection = document.getSelection();
        selection?.setBaseAndExtent(
            range.startContainer,
            range.startOffset,
            range.endContainer,
            range.endOffset,
        );
        document.dispatchEvent(new Event('selectionchange'));
    };
    const report = (error: unknown): void => {
        ui.notifications.show({
            message: error instanceof Error ? error.message : String(error),
            severity: 'error',
        });
    };
    const click = (event: MouseEvent): void => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
        const origin = event.target;
        if (origin instanceof Element && origin.closest('img') !== null) {
            close();
            return;
        }
        const link =
            origin instanceof Element
                ? origin.closest<HTMLAnchorElement>(
                      'a[data-soeditor-link="true"], a[href]',
                  )
                : null;
        if (link === null || !visual.contains(link)) return;
        event.preventDefault();
        selectLink(link);
        close();
        activeLink = link;
        balloon = ui.balloons.show({
            anchor: link,
            placement: 'above',
            content: (container) => {
                container.setAttribute('aria-label', 'Link actions');
                const value = document.createElement('span');
                let inspected: unknown;
                try {
                    inspected = editor.execute('link.inspect');
                } catch {
                    inspected = undefined;
                }
                const href =
                    typeof inspected === 'object' && inspected !== null
                        ? Reflect.get(inspected, 'href')
                        : undefined;
                value.textContent = typeof href === 'string' ? href : '';
                const edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'soeditor-ui__button';
                ui.setIcon(edit, 'link.edit', 'Edit link');
                edit.title = 'Edit link';
                edit.setAttribute('aria-label', 'Edit link');
                edit.addEventListener('click', () => {
                    const current = activeLink;
                    close();
                    if (current === undefined) return;
                    selectLink(current);
                    ui.toolbarElement
                        .querySelector<HTMLButtonElement>(
                            '[data-toolbar-item="link"]',
                        )
                        ?.click();
                });
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'soeditor-ui__button';
                ui.setIcon(remove, 'link.remove', 'Remove link');
                remove.title = 'Remove link';
                remove.setAttribute('aria-label', 'Remove link');
                remove.addEventListener('click', () => {
                    const current = activeLink;
                    close();
                    if (current === undefined) return;
                    selectLink(current);
                    try {
                        editor.execute('link.remove');
                    } catch (error: unknown) {
                        report(error);
                    }
                });
                container.append(value, edit, remove);
            },
        });
    };
    const pointerDown = (event: PointerEvent): void => {
        const target = event
            .composedPath()
            .find((candidate): candidate is Node => candidate instanceof Node);
        if (!(target instanceof Node)) return;
        if (balloon?.element.contains(target) === true) return;
        if (
            target instanceof Element &&
            target.closest('a[data-soeditor-link="true"], a[href]') ===
                activeLink
        ) {
            return;
        }
        close();
    };
    const keydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' || balloon === undefined) return;
        event.preventDefault();
        close();
        visual.focus({ preventScroll: true });
    };
    visual.addEventListener('click', click);
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('keydown', keydown);
    return () => {
        close();
        visual.removeEventListener('click', click);
        document.removeEventListener('pointerdown', pointerDown, true);
        document.removeEventListener('keydown', keydown);
    };
}
