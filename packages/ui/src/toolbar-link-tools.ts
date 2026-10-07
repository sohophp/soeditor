import { createToolbarRoot } from './toolbar-root.js';

import type { LinkTargetProvider } from './link-attributes.js';
import type { ToolbarItemFactory } from './types.js';
import {
    field,
    updateCommandButton,
    execute,
    reportError,
} from './toolbar-tool-shared.js';
const loadLinkAttributeTools = () => import('./link-attributes.js');
let nextLinkUrlId = 0;

const linkButton: ToolbarItemFactory = ({ document, editor, ui }) => {
    const button = createToolbarRoot(document, ui, 'button');
    button.type = 'button';
    button.className = 'soeditor-ui__button';
    ui.setIcon(button, 'link.set', 'Link');
    button.title = 'Link';
    button.setAttribute('aria-label', 'Link');
    const click = async (): Promise<void> => {
        ui.restoreEditingSelection();
        const current = editor.commands.has('link.inspect')
            ? editor.commands.canExecute('link.inspect')
                ? editor.execute('link.inspect')
                : undefined
            : undefined;
        const values =
            typeof current === 'object' && current !== null
                ? (current as Record<string, unknown>)
                : {};
        const selectedText = ui.getEditingSelectionText();
        const attributeTools = await loadLinkAttributeTools().catch(
            (error: unknown) => {
                reportError(ui, error);
                return undefined;
            },
        );
        if (attributeTools === undefined) return;
        if (!button.isConnected) return;
        const { linkCustomAttributeField, readInspectedCustomAttributes } =
            attributeTools;
        const attributeSuggestions = editor.commands.has(
            'link.attributes.catalog',
        )
            ? editor.execute('link.attributes.catalog')
            : [];
        const editingExisting = typeof values.href === 'string';
        const body = document.createElement('div');
        body.className = 'soeditor-ui__link-dialog-form';
        const essentials = document.createElement('div');
        essentials.className = 'soeditor-ui__link-essentials';
        const displayed = field(
            document,
            essentials,
            'Displayed text',
            'text',
            false,
            selectedText,
        );
        const hrefField = document.createElement('div');
        hrefField.className = 'soeditor-ui__field soeditor-ui__link-url-field';
        const hrefCaption = document.createElement('label');
        hrefCaption.textContent = 'Link URL';
        const href = document.createElement('input');
        href.id = `soeditor-link-url-${++nextLinkUrlId}`;
        hrefCaption.htmlFor = href.id;
        href.type = 'text';
        href.required = true;
        href.value = typeof values.href === 'string' ? values.href : '';
        const hrefControl = document.createElement('div');
        hrefControl.className = 'soeditor-ui__link-url-control';
        hrefControl.append(href);
        hrefField.append(hrefCaption, hrefControl);
        essentials.append(hrefField);
        displayed.autocomplete = 'off';
        displayed.placeholder = 'Text shown to readers';
        href.setAttribute('autocomplete', 'url');
        href.inputMode = 'url';
        href.placeholder = 'https://example.com/page';
        href.spellcheck = false;

        const advancedFields = document.createElement('div');
        advancedFields.className = 'soeditor-ui__link-advanced-fields';
        const title = field(
            document,
            advancedFields,
            'Title',
            'text',
            false,
            typeof values.title === 'string' ? values.title : '',
        );
        title.autocomplete = 'off';
        title.placeholder = 'Optional tooltip';
        const disposeTargetControls = attributeTools.attachLinkTargetControls({
            document,
            container: hrefField,
            fileButtonContainer: hrefControl,
            href,
            title,
            displayed,
            selectedText,
            provider: editor.services.tryGet<LinkTargetProvider>(
                'soeditor.link-target-provider',
            ),
            translate: (message: string) => ui.translate(message),
            report: (error: unknown) => reportError(ui, error),
            fileIcon: (element: HTMLElement) =>
                ui.setIcon(element, 'link.file.browse', 'Files'),
        });
        const target = linkTargetField(
            document,
            advancedFields,
            typeof values.target === 'string' ? values.target : '',
        );
        const rel = relationshipTagField(
            document,
            advancedFields,
            typeof values.rel === 'string' ? values.rel : '',
        );
        const customAttributes = linkCustomAttributeField(
            document,
            advancedFields,
            readInspectedCustomAttributes(values),
            attributeSuggestions,
            ui.translate,
        );
        const tabs = document.createElement('div');
        tabs.className = 'soeditor-ui__link-tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', ui.translate('Link'));
        const panels = document.createElement('div');
        panels.className = 'soeditor-ui__link-panels';
        const sections = [essentials, advancedFields];
        const tabButtons = sections.map((panel, index) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.textContent =
                index === 0 ? 'Basic settings' : 'Advanced settings';
            tab.id = `${href.id}-tab-${index}`;
            tab.setAttribute('role', 'tab');
            panel.id = `${href.id}-panel-${index}`;
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', tab.id);
            tab.setAttribute('aria-controls', panel.id);
            tabs.append(tab);
            panels.append(panel);
            return tab;
        });
        const selectTab = (index: number, focus = false): void => {
            tabButtons.forEach((tab, candidate) => {
                const selected = candidate === index;
                tab.setAttribute('aria-selected', String(selected));
                tab.tabIndex = selected ? 0 : -1;
            });
            sections.forEach((panel, candidate) => {
                panel.hidden = candidate !== index;
            });
            if (focus) tabButtons[index]?.focus();
        };
        tabButtons.forEach((tab, index) => {
            tab.addEventListener('click', () => selectTab(index));
            tab.addEventListener('keydown', (event) => {
                const next =
                    event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? 1
                          : event.key === 'ArrowLeft' ||
                              event.key === 'ArrowRight'
                            ? 1 - index
                            : undefined;
                if (next === undefined) return;
                event.preventDefault();
                selectTab(next, true);
            });
        });
        // Reveal invalid fields before native validation tries to focus them.
        href.addEventListener('invalid', () => selectTab(0));
        advancedFields.addEventListener('invalid', () => selectTab(1), true);
        selectTab(0);
        body.append(tabs, panels);
        const save = (): void => {
            href.value = href.value.trim();
            if (!href.reportValidity()) return;
            const customAttributeResult = customAttributes.value();
            if (customAttributeResult === undefined) return;
            const text = displayed.value || href.value;
            const attributes = {
                href: href.value,
                customAttributes: customAttributeResult,
                ...(title.value.length === 0 ? {} : { title: title.value }),
                ...(target.value.length === 0 ? {} : { target: target.value }),
                ...(rel.value().length === 0 ? {} : { rel: rel.value() }),
            };
            const command = text === selectedText ? 'link.set' : 'link.setText';
            if (
                execute(editor, ui, command, [
                    command === 'link.set'
                        ? attributes
                        : { ...attributes, text },
                ])
            ) {
                handle.close();
            }
        };
        const handle = ui.dialogs.open({
            title: editingExisting ? 'Edit link' : 'Link',
            returnFocus: button,
            content: body,
            actions: [
                ...(editingExisting
                    ? [
                          {
                              kind: 'danger' as const,
                              label: 'Remove link',
                              run: (): void => {
                                  if (execute(editor, ui, 'link.remove', [])) {
                                      handle.close();
                                  }
                              },
                          },
                      ]
                    : []),
                {
                    kind: 'primary',
                    label: editingExisting ? 'Update link' : 'Insert link',
                    run: save,
                },
            ],
        });
        handle.element.classList.add('soeditor-ui__link-dialog');
        handle.element.addEventListener('close', disposeTargetControls);
        body.addEventListener('keydown', (event) => {
            const view = document.defaultView;
            const fromInput =
                view !== null && event.target instanceof view.HTMLInputElement;
            if (
                event.key !== 'Enter' ||
                event.isComposing ||
                event.defaultPrevented ||
                !fromInput
            ) {
                return;
            }
            event.preventDefault();
            save();
        });
        href.focus();
        href.select();
    };
    button.addEventListener('click', click);
    return {
        element: button,
        update: () => updateCommandButton(button, editor, 'link.set'),
        destroy: () => button.removeEventListener('click', click),
    };
};

const commonLinkTargets = Object.freeze([
    { label: 'Same window (_self)', value: '_self' },
    { label: 'New window or tab (_blank)', value: '_blank' },
    { label: 'Parent frame (_parent)', value: '_parent' },
    { label: 'Top frame (_top)', value: '_top' },
] as const);

const commonLinkRelationships = Object.freeze([
    'nofollow',
    'sponsored',
    'ugc',
    'noopener',
    'noreferrer',
    'external',
] as const);

function linkTargetField(
    document: Document,
    container: HTMLElement,
    value: string,
): HTMLInputElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'soeditor-ui__field';
    const caption = document.createElement('span');
    caption.textContent = 'Target';
    const controls = document.createElement('div');
    controls.className = 'soeditor-ui__link-target-controls';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Common target');
    const prompt = document.createElement('option');
    prompt.value = '';
    prompt.textContent = 'Choose a common target';
    select.append(prompt);
    for (const entry of commonLinkTargets) {
        const option = document.createElement('option');
        option.value = entry.value;
        option.textContent = entry.label;
        select.append(option);
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = 'Custom target name';
    input.setAttribute('aria-label', 'Target');
    input.autocomplete = 'off';
    select.addEventListener('change', () => {
        if (select.value.length === 0) return;
        input.value = select.value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    controls.append(select, input);
    wrapper.append(caption, controls);
    container.append(wrapper);
    return input;
}

interface RelationshipTagInput {
    value(): string;
}

function relationshipTagField(
    document: Document,
    container: HTMLElement,
    value: string,
): RelationshipTagInput {
    const wrapper = document.createElement('div');
    wrapper.className = 'soeditor-ui__field';
    const caption = document.createElement('span');
    caption.textContent = 'Relationship';
    const choices = document.createElement('div');
    choices.className = 'soeditor-ui__link-rel-choices';
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', 'Common relationships');
    const selected = new Set(
        value
            .split(/\s+/u)
            .map((token) => token.trim().toLowerCase())
            .filter((token) => token.length > 0),
    );
    const buttons = new Map<string, HTMLButtonElement>();

    const updateButton = (token: string): void => {
        const button = buttons.get(token);
        if (button === undefined) return;
        const active = selected.has(token);
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-pressed', String(active));
    };
    const addChoice = (token: string): void => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__link-rel-tag';
        button.textContent = token;
        button.title = `Toggle relationship ${token}`;
        button.setAttribute('aria-label', `Relationship ${token}`);
        button.addEventListener('click', () => {
            if (selected.has(token)) selected.delete(token);
            else selected.add(token);
            updateButton(token);
        });
        buttons.set(token, button);
        choices.append(button);
        updateButton(token);
    };
    for (const token of commonLinkRelationships) addChoice(token);
    for (const token of selected) {
        if (!buttons.has(token)) addChoice(token);
    }

    const customControls = document.createElement('div');
    customControls.className = 'soeditor-ui__link-rel-custom';
    const custom = document.createElement('input');
    custom.type = 'text';
    custom.placeholder = 'Custom relationship';
    custom.autocomplete = 'off';
    custom.setAttribute('aria-label', 'Add relationship');
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'soeditor-ui__dialog-action';
    add.textContent = 'Add';
    const commitCustom = (): void => {
        const token = custom.value.trim().toLowerCase();
        if (!/^[a-z][a-z0-9.-]{0,63}$/u.test(token)) {
            custom.setCustomValidity(
                'Use one relationship token beginning with a letter; letters, numbers, dots, and hyphens are supported.',
            );
            custom.reportValidity();
            return;
        }
        custom.setCustomValidity('');
        selected.add(token);
        if (!buttons.has(token)) addChoice(token);
        else updateButton(token);
        custom.value = '';
        custom.focus();
    };
    custom.addEventListener('input', () => custom.setCustomValidity(''));
    custom.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commitCustom();
    });
    add.addEventListener('click', commitCustom);
    customControls.append(custom, add);
    wrapper.append(caption, choices, customControls);
    container.append(wrapper);
    return {
        value: () => [...selected].sort().join(' '),
    };
}

export { linkButton };
