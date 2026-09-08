/** Load window controls only after a dialog exists; base dialogs stay usable. */
export function attachLazyClassicDialogWindows(
    root: HTMLElement,
    translate: (message: string) => string,
    locale: string,
): () => void {
    const view = root.ownerDocument.defaultView;
    if (view === null) return () => undefined;
    let destroyed = false;
    let loading: Promise<void> | undefined;
    let dispose: (() => void) | undefined;
    const load = (): void => {
        loading ??= import('./classic-dialog-windows.js')
            .then(({ attachClassicDialogWindows }) => {
                if (destroyed) return;
                dispose = attachClassicDialogWindows(root, translate, locale);
                observer.disconnect();
            })
            .catch(() => {
                // Base dialogs remain usable if this optional enhancement fails.
                loading = undefined;
            });
    };
    const observer = new view.MutationObserver((records) => {
        for (const record of records)
            for (const node of Array.from(record.addedNodes))
                if (
                    node instanceof view.Element &&
                    (node.matches('.soeditor-ui__dialog') ||
                        node.querySelector('.soeditor-ui__dialog') !== null)
                )
                    load();
    });
    observer.observe(root, { childList: true, subtree: true });
    if (root.querySelector('.soeditor-ui__dialog') !== null) load();
    return () => {
        destroyed = true;
        observer.disconnect();
        dispose?.();
    };
}
