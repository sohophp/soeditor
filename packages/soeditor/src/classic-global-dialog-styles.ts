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
    const ensureStyles = (): void => {
        if (
            document.querySelector('link[data-soeditor-dialog-styles]') !== null
        )
            return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = stylesheetUrl;
        link.setAttribute('data-soeditor-dialog-styles', '');
        document.head.append(link);
    };
    const colorInteraction = (event: Event): void => {
        if (
            event.target instanceof Element &&
            event.target.closest('.soeditor-ui__color-menu')
        )
            ensureStyles();
    };
    root.addEventListener('click', colorInteraction, true);
    root.addEventListener('keydown', colorInteraction, true);
    const observer = new view.MutationObserver(() => {
        if (
            root.querySelector(
                '.soeditor-ui__dialog, .soeditor-ui__color-panel',
            ) === null
        )
            return;
        ensureStyles();
        observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
        observer.disconnect();
        root.removeEventListener('click', colorInteraction, true);
        root.removeEventListener('keydown', colorInteraction, true);
    };
}
