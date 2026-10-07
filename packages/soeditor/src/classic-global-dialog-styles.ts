// The global bundle captures its own URL before asynchronous editor creation.
const stylesheetUrl =
    import.meta.env.SOEDITOR_STANDALONE_VIDEO === 'true'
        ? new URL('./classic-dialogs.css', import.meta.url).href
        : undefined;

/** Load detailed global dialog styling on first use, shared by document. */
export function attachGlobalDialogStyles(root: HTMLElement): () => void {
    if (stylesheetUrl === undefined) return () => undefined;
    const document = root.ownerDocument;
    const view = document.defaultView;
    if (view === null) return () => undefined;
    const observer = new view.MutationObserver(() => {
        if (root.querySelector('.soeditor-ui__dialog') === null) return;
        if (
            document.querySelector('link[data-soeditor-dialog-styles]') === null
        ) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = stylesheetUrl;
            link.setAttribute('data-soeditor-dialog-styles', '');
            document.head.append(link);
        }
        observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
}
