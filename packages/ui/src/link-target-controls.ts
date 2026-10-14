import type { LinkTargetProvider } from './link-attributes.js';

let nextSuggestionId = 0;

/** Optional link target controls, loaded with the Link dialog rather than editor startup. */
export function attachLinkTargetControlsNow(
    options: {
        document: Document;
        container: HTMLElement;
        fileButtonContainer: HTMLElement;
        href: HTMLInputElement;
        title?: HTMLInputElement;
        displayed?: HTMLInputElement;
        selectedText: string;
        provider: LinkTargetProvider | undefined;
        translate(message: string): string;
        report(error: unknown): void;
        fileIcon(element: HTMLElement): void;
    },
    searchOnAttach = false,
): () => void {
    const {
        document,
        container,
        fileButtonContainer,
        href,
        title,
        displayed,
        selectedText,
        translate,
        report,
        fileIcon,
    } = options;
    const provider = options.provider;
    let searchVersion = 0;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;
    let activeIndex = -1;
    let composing = false;
    const suggestions = document.createElement('div');
    suggestions.className = 'soeditor-ui__link-suggestions';
    suggestions.id = `soeditor-link-suggestions-${++nextSuggestionId}`;
    suggestions.setAttribute('role', 'listbox');
    suggestions.setAttribute('aria-label', translate('Choose internal link'));
    suggestions.hidden = true;
    const clearSuggestions = (): void => {
        searchVersion++;
        if (searchTimer !== undefined) clearTimeout(searchTimer);
        suggestions.replaceChildren();
        suggestions.hidden = true;
        activeIndex = -1;
        href.setAttribute('aria-expanded', 'false');
        href.removeAttribute('aria-activedescendant');
    };
    const activateSuggestion = (index: number): void => {
        const entries = suggestions.querySelectorAll<HTMLButtonElement>(
            '.soeditor-ui__link-suggestion:not(:disabled)',
        );
        if (entries.length === 0) return;
        activeIndex = (index + entries.length) % entries.length;
        entries.forEach((entry, entryIndex) => {
            const selected = entryIndex === activeIndex;
            entry.classList.toggle('is-active', selected);
            entry.setAttribute('aria-selected', String(selected));
        });
        const active = entries.item(activeIndex);
        if (active === null) return;
        href.setAttribute('aria-activedescendant', active.id);
        // Scroll only the list; scrolling ancestors can move the URL input.
        const listBounds = suggestions.getBoundingClientRect();
        const activeBounds = active.getBoundingClientRect();
        if (activeBounds.top < listBounds.top)
            suggestions.scrollTop -= listBounds.top - activeBounds.top;
        else if (activeBounds.bottom > listBounds.bottom)
            suggestions.scrollTop += activeBounds.bottom - listBounds.bottom;
    };

    if (typeof provider?.searchInternal === 'function') {
        container.classList.add('soeditor-ui__link-url-field--suggestions');
        href.placeholder = translate(
            'Enter / to search site pages or paste a URL',
        );
        href.setAttribute('role', 'combobox');
        href.setAttribute('aria-autocomplete', 'list');
        href.setAttribute('aria-controls', suggestions.id);
        href.setAttribute('aria-expanded', 'false');
        const search = (): void => {
            const query = href.value.trim();
            if (composing || !query.startsWith('/') || query.startsWith('//')) {
                clearSuggestions();
                return;
            }
            // Keep the current list visible while the next query is pending.
            // Hiding it on every keystroke makes the dropdown flash repeatedly.
            const version = ++searchVersion;
            if (searchTimer !== undefined) clearTimeout(searchTimer);
            activeIndex = -1;
            href.removeAttribute('aria-activedescendant');
            suggestions
                .querySelectorAll<HTMLButtonElement>(
                    '.soeditor-ui__link-suggestion',
                )
                .forEach((entry) => {
                    entry.disabled = true;
                    entry.classList.remove('is-active');
                    entry.setAttribute('aria-selected', 'false');
                });
            searchTimer = setTimeout(() => {
                void Promise.resolve()
                    .then(() => provider.searchInternal!(query))
                    .then((targets) => {
                        if (version !== searchVersion || !href.isConnected)
                            return;
                        suggestions.replaceChildren();
                        suggestions.scrollTop = 0;
                        for (const item of targets.slice(0, 20)) {
                            if (
                                !item.href.startsWith('/') ||
                                item.href.startsWith('//')
                            )
                                continue;
                            const option = document.createElement('button');
                            option.type = 'button';
                            option.className = 'soeditor-ui__link-suggestion';
                            option.setAttribute('role', 'option');
                            option.setAttribute('aria-selected', 'false');
                            option.id = `${suggestions.id}-${suggestions.childElementCount}`;
                            option.tabIndex = -1;
                            const label = document.createElement('span');
                            label.className =
                                'soeditor-ui__link-suggestion-title';
                            label.textContent = item.title;
                            const url = document.createElement('span');
                            url.className = 'soeditor-ui__link-suggestion-url';
                            url.textContent = item.href;
                            option.append(label, url);
                            option.addEventListener('pointerdown', (event) => {
                                event.preventDefault();
                            });
                            option.addEventListener('click', () => {
                                href.value = item.href;
                                if (title) title.value = item.title;
                                if (
                                    !selectedText &&
                                    displayed &&
                                    !displayed.value
                                )
                                    displayed.value = item.title;
                                clearSuggestions();
                                href.focus();
                            });
                            suggestions.append(option);
                        }
                        suggestions.hidden =
                            suggestions.childElementCount === 0;
                        href.setAttribute(
                            'aria-expanded',
                            String(!suggestions.hidden),
                        );
                    })
                    .catch((error: unknown) => {
                        if (version === searchVersion) report(error);
                    });
            }, 200);
        };
        href.addEventListener('input', search);
        href.addEventListener('compositionstart', () => {
            composing = true;
            clearSuggestions();
        });
        href.addEventListener('compositionend', () => {
            composing = false;
            search();
        });
        href.addEventListener('keydown', (event) => {
            if (composing || event.isComposing) return;
            if (suggestions.hidden) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                activateSuggestion(
                    activeIndex < 0
                        ? event.key === 'ArrowDown'
                            ? 0
                            : -1
                        : activeIndex + (event.key === 'ArrowDown' ? 1 : -1),
                );
            } else if (event.key === 'Enter' && activeIndex >= 0) {
                event.preventDefault();
                const entries = suggestions.querySelectorAll<HTMLButtonElement>(
                    '.soeditor-ui__link-suggestion',
                );
                entries.item(activeIndex)?.click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                clearSuggestions();
            }
        });
        href.addEventListener('blur', clearSuggestions);
        container.append(suggestions);
        if (searchOnAttach) search();
    }

    if (typeof provider?.select === 'function') {
        const chooseFile = document.createElement('button');
        chooseFile.type = 'button';
        chooseFile.className = 'soeditor-ui__link-file';
        chooseFile.title = translate('Choose file link');
        chooseFile.setAttribute('aria-label', translate('Choose file link'));
        const icon = document.createElement('span');
        icon.className = 'soeditor-ui__link-file-icon';
        fileIcon(icon);
        chooseFile.append(icon);
        chooseFile.addEventListener('click', () => {
            clearSuggestions();
            chooseFile.disabled = true;
            chooseFile.setAttribute('aria-busy', 'true');
            void Promise.resolve()
                .then(() => provider.select('file'))
                .then((selected) => {
                    if (selected === null || !href.isConnected) return;
                    href.value = selected.href;
                    if (selected.title && title) title.value = selected.title;
                    if (
                        !selectedText &&
                        displayed &&
                        !displayed.value &&
                        selected.title
                    )
                        displayed.value = selected.title;
                    clearSuggestions();
                    href.focus();
                })
                .catch(report)
                .finally(() => {
                    chooseFile.disabled = false;
                    chooseFile.removeAttribute('aria-busy');
                });
        });
        fileButtonContainer.append(chooseFile);
    }

    return () => {
        searchVersion++;
        if (searchTimer !== undefined) clearTimeout(searchTimer);
    };
}
