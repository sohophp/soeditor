/** Position all toolbar menus without changing their containing block. */
export function bindToolbarMenus(toolbar: HTMLElement): () => void {
    const document = toolbar.ownerDocument;
    const menus = (): HTMLDetailsElement[] =>
        Array.from(toolbar.querySelectorAll('details.soeditor-ui__menu'));
    const position = (details: HTMLDetailsElement): void => {
        details
            .querySelector('summary')
            ?.setAttribute('aria-expanded', String(details.open));
        const menu = details.querySelector<HTMLElement>(
            ':scope > .soeditor-ui__menu-items, :scope > .soeditor-ui__color-panel',
        );
        if (!menu) return;
        if (!details.open) {
            if (menu.matches(':popover-open')) menu.hidePopover();
            return;
        }
        const anchor = details.getBoundingClientRect();
        if (typeof menu.showPopover === 'function') {
            menu.setAttribute('popover', 'manual');
            menu.style.position = 'fixed';
            menu.style.inset = 'auto';
            menu.style.margin = '0';
            menu.style.left = `${anchor.left}px`;
            menu.style.top = `${anchor.bottom}px`;
            if (!menu.matches(':popover-open')) menu.showPopover();
        }
        const scale =
            menu.offsetWidth > 0
                ? menu.getBoundingClientRect().width / menu.offsetWidth
                : 1;
        if (menu.matches(':popover-open')) {
            menu.style.left = `${anchor.left / scale}px`;
            menu.style.top = `${anchor.bottom / scale}px`;
        }
        const width = document.documentElement.clientWidth;
        const height = document.documentElement.clientHeight;
        menu.style.transform = '';
        menu.style.boxSizing = 'border-box';
        menu.style.maxInlineSize = `${Math.max(0, width - 16) / scale}px`;
        menu.style.overflowY = 'auto';
        const below = Math.max(0, height - anchor.bottom - 12);
        const above = Math.max(0, anchor.top - 12);
        const fullHeight =
            (menu.scrollHeight + menu.offsetHeight - menu.clientHeight) * scale;
        const flip = fullHeight > below && above > below;
        menu.style.maxBlockSize = `${Math.max(0, Math.min(height - 16, flip ? above : below)) / scale}px`;
        const rect = menu.getBoundingClientRect();
        const x = Math.max(8 - rect.left, Math.min(0, width - 8 - rect.right));
        const top = flip ? anchor.top - 4 - rect.height : anchor.bottom + 4;
        const y =
            Math.max(8, Math.min(height - 8 - rect.height, top)) - rect.top;
        menu.style.transform = `translate(${x / scale}px, ${y / scale}px)`;
        menu.dataset.placement = flip ? 'above' : 'below';
    };
    const toggle = (event: Event): void => {
        const details = event.target;
        if (
            !(details instanceof HTMLDetailsElement) ||
            !details.matches('.soeditor-ui__menu')
        )
            return;
        if (details.open)
            for (const other of menus())
                if (other !== details) other.open = false;
        position(details);
    };
    const viewport = (event: Event): void => {
        if (
            event.target instanceof Element &&
            event.target.closest(
                '.soeditor-ui__menu-items, .soeditor-ui__color-panel',
            )
        )
            return;
        for (const details of menus()) if (details.open) position(details);
    };
    const click = (event: MouseEvent): void => {
        if (
            event.target instanceof Element &&
            event.target.closest('summary[aria-disabled="true"]')
        )
            event.preventDefault();
    };
    const ResizeObserver = document.defaultView?.ResizeObserver;
    const observer = ResizeObserver
        ? new ResizeObserver(() => {
              for (const details of menus())
                  if (details.open) position(details);
          })
        : undefined;
    for (const details of menus()) {
        observer?.observe(details);
        const panel = details.querySelector<HTMLElement>(
            ':scope > .soeditor-ui__menu-items, :scope > .soeditor-ui__color-panel',
        );
        if (panel) observer?.observe(panel);
        const summary = details.querySelector('summary');
        if (
            summary &&
            !summary.matches('.soeditor-ui__value-control') &&
            !summary.querySelector('.soeditor-ui__format-arrow')
        ) {
            const arrow = document.createElement('span');
            arrow.className = 'soeditor-ui__format-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '▾';
            summary.append(arrow);
        }
        position(details);
    }
    toolbar.addEventListener('toggle', toggle, true);
    toolbar.addEventListener('click', click, true);
    document.addEventListener('scroll', viewport, true);
    document.defaultView?.addEventListener('resize', viewport);
    return () => {
        observer?.disconnect();
        toolbar.removeEventListener('toggle', toggle, true);
        toolbar.removeEventListener('click', click, true);
        document.removeEventListener('scroll', viewport, true);
        document.defaultView?.removeEventListener('resize', viewport);
    };
}

/** Leave text fields to native editing and keep menu arrows inside the menu. */
export function navigateToolbarMenu(
    event: KeyboardEvent,
    toolbar: HTMLElement,
): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !toolbar.contains(target))
        return false;
    if (target.matches('input,textarea,select,[contenteditable="true"]'))
        return false;
    const details = target.closest<HTMLDetailsElement>(
        'details.soeditor-ui__menu',
    );
    if (!details) return false;
    const summary = target.tagName === 'SUMMARY';
    if (
        summary
            ? !['ArrowDown', 'ArrowUp'].includes(event.key)
            : ![
                  'ArrowDown',
                  'ArrowUp',
                  'ArrowLeft',
                  'ArrowRight',
                  'Home',
                  'End',
              ].includes(event.key)
    )
        return false;
    if (
        details.querySelector('summary')?.getAttribute('aria-disabled') ===
        'true'
    )
        return false;
    details.open = true;
    const buttons = Array.from(
        details.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ).filter((button) => !button.closest('[hidden]'));
    const current = buttons.indexOf(target as HTMLButtonElement);
    const vertical = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    const columns = target.parentElement
        ? (toolbar.ownerDocument.defaultView
              ?.getComputedStyle(target.parentElement)
              .gridTemplateColumns.split(' ').length ?? 1)
        : 1;
    const step = vertical ? columns : 1;
    const index =
        event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : current < 0
                ? event.key === 'ArrowUp'
                    ? buttons.length - 1
                    : 0
                : (current +
                      (['ArrowUp', 'ArrowLeft'].includes(event.key)
                          ? -step
                          : step) +
                      buttons.length) %
                  buttons.length;
    event.preventDefault();
    event.stopPropagation();
    buttons[index]?.focus();
    return true;
}
