import type {
    ToolbarConfiguration,
    ToolbarDrawerConfiguration,
    ToolbarItemContext,
    ToolbarItemFactory,
    ToolbarItemInstance,
} from './types.js';

/** Reports an unknown configured toolbar item. */
export class ToolbarItemNotRegisteredError extends Error {
    constructor(id: string) {
        super(`Toolbar item "${id}" is not registered.`);
        this.name = 'ToolbarItemNotRegisteredError';
    }
}

export function mountToolbar(
    configuration: ToolbarConfiguration,
    toolbar: HTMLElement,
    factories: ReadonlyMap<string, ToolbarItemFactory>,
    context: ToolbarItemContext,
    instances: ToolbarItemInstance[],
): void {
    let previousSeparator = true;
    for (const id of configuration) {
        if (typeof id === 'object' && id !== null) {
            mountToolbarDrawer(id, toolbar, factories, context, instances);
            previousSeparator = false;
            continue;
        }
        if (id === '|') {
            if (previousSeparator) {
                throw new TypeError(
                    'Toolbar separators must appear between toolbar items.',
                );
            }
            const separator = context.document.createElement('span');
            separator.className = 'soeditor-ui__separator';
            separator.setAttribute('role', 'separator');
            toolbar.append(separator);
            previousSeparator = true;
            continue;
        }
        if (typeof id !== 'string' || id.trim().length === 0) {
            throw new TypeError('A toolbar item ID must not be empty.');
        }
        const factory = factories.get(id);
        if (factory === undefined) {
            throw new ToolbarItemNotRegisteredError(id);
        }
        const instance = factory(context);
        if (
            typeof instance !== 'object' ||
            instance === null ||
            instance.element.ownerDocument !== context.document
        ) {
            throw new TypeError(
                `Toolbar item "${id}" returned an invalid element.`,
            );
        }
        instance.element.dataset.toolbarItem = id;
        toolbar.append(instance.element);
        instances.push(instance);
        previousSeparator = false;
    }
    if (previousSeparator && configuration.length > 0) {
        throw new TypeError('A toolbar must not end with a separator.');
    }
}

export function mountToolbarDrawer(
    configuration: ToolbarDrawerConfiguration,
    toolbar: HTMLElement,
    factories: ReadonlyMap<string, ToolbarItemFactory>,
    context: ToolbarItemContext,
    instances: ToolbarItemInstance[],
): HTMLElement {
    if (
        typeof configuration.id !== 'string' ||
        configuration.id.trim() === '' ||
        typeof configuration.label !== 'string' ||
        configuration.label.trim() === '' ||
        !Array.isArray(configuration.items) ||
        configuration.items.length === 0 ||
        configuration.items.some(
            (item: unknown) => typeof item !== 'string' || item === '|',
        )
    ) {
        throw new TypeError('Invalid toolbar drawer configuration.');
    }
    const { document, ui } = context;
    const drawer = document.createElement('details');
    drawer.className = 'soeditor-ui__menu';
    drawer.dataset.toolbarItem = configuration.id;
    const summary = document.createElement('summary');
    summary.className = 'soeditor-ui__button';
    summary.title = ui.translate(configuration.label);
    summary.setAttribute('aria-label', summary.title);
    ui.setIcon(summary, 'format.more', '⋯');
    const panel = document.createElement('div');
    panel.className = 'soeditor-ui__menu-items';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', summary.title);
    drawer.append(summary, panel);
    toolbar.append(drawer);
    const start = instances.length;
    mountToolbar(configuration.items, panel, factories, context, instances);
    const buttons = instances.slice(start).map((instance, index) => {
        const button = instance.element;
        if (!(button instanceof HTMLButtonElement)) {
            throw new TypeError(
                'Toolbar drawer items must be labeled buttons.',
            );
        }
        const label =
            button.getAttribute('aria-label') ||
            button.title ||
            button.textContent ||
            '';
        if (label.trim() === '')
            throw new TypeError(
                'Toolbar drawer items must be labeled buttons.',
            );
        button.classList.add('soeditor-ui__menu-item');
        const update = (): void => {
            instance.update?.();
            const translated = ui.translate(label);
            if (
                button.textContent !== translated ||
                button.childElementCount > 0
            )
                button.textContent = translated;
        };
        instances[start + index] = {
            element: button,
            update,
            destroy: () => instance.destroy?.(),
        };
        update();
        return button;
    });
    const click = (event: MouseEvent): void => {
        if (
            event.target instanceof Element &&
            event.target.closest('button:not(:disabled)')
        )
            drawer.open = false;
    };
    panel.addEventListener('click', click);
    instances.push({
        element: drawer,
        update: () =>
            summary.setAttribute(
                'aria-disabled',
                String(buttons.every((button) => button.disabled)),
            ),
        destroy: () => panel.removeEventListener('click', click),
    });
    return drawer;
}

export function destroyToolbarItems(
    items: readonly ToolbarItemInstance[],
): void {
    const errors: unknown[] = [];
    for (const item of [...items].reverse()) {
        try {
            item.destroy?.();
        } catch (error: unknown) {
            errors.push(error);
        }
    }
    if (errors.length > 0) {
        throw new AggregateError(errors, 'Toolbar item cleanup failed.');
    }
}
