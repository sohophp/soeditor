export interface TableTagAttribute {
    readonly name: string;
    readonly value: string;
}

interface AttributeSuggestion {
    readonly name: string;
    readonly values?: readonly string[];
}

export interface TableDimensionControl {
    readonly element: HTMLElement;
    focus(): void;
    validate(): boolean;
    value(): string;
}

export type TablePropertyKind = 'cell' | 'row' | 'section' | 'table';

export interface TablePropertyField {
    readonly advanced?: boolean;
    readonly key: string;
    readonly label: string;
    readonly options?: readonly string[];
    readonly type: 'dimension' | 'readonly' | 'select' | 'text';
}

export function tablePropertyFields(
    kind: TablePropertyKind,
): readonly TablePropertyField[] {
    if (kind === 'section') return [];
    if (kind === 'table')
        return [
            { key: 'caption', label: 'Caption', type: 'text' },
            { key: 'width', label: 'Table width', type: 'dimension' },
            { key: 'height', label: 'Table height', type: 'dimension' },
            {
                key: 'alignment',
                label: 'Alignment',
                options: ['left', 'center', 'right'],
                type: 'select',
            },
            {
                advanced: true,
                key: 'responsiveClass',
                label: 'Responsive classes',
                type: 'text',
            },
            {
                advanced: true,
                key: 'ariaLabel',
                label: 'Accessible label',
                type: 'text',
            },
        ];
    if (kind === 'row')
        return [
            {
                key: 'section',
                label: 'Section',
                options: ['head', 'body', 'foot'],
                type: 'select',
            },
            { key: 'height', label: 'Height', type: 'dimension' },
            {
                advanced: true,
                key: 'className',
                label: 'Row classes',
                type: 'text',
            },
            {
                advanced: true,
                key: 'ariaLabel',
                label: 'Accessible label',
                type: 'text',
            },
        ];
    return [
        { key: 'width', label: 'Cell width', type: 'dimension' },
        { key: 'height', label: 'Cell height', type: 'dimension' },
        {
            key: 'horizontalAlignment',
            label: 'Horizontal alignment',
            options: ['left', 'center', 'right'],
            type: 'select',
        },
        {
            key: 'verticalAlignment',
            label: 'Vertical alignment',
            options: ['top', 'middle', 'bottom', 'baseline'],
            type: 'select',
        },
        {
            key: 'scope',
            label: 'Header scope',
            options: ['col', 'colgroup', 'row', 'rowgroup'],
            type: 'select',
        },
        {
            advanced: true,
            key: 'className',
            label: 'Cell classes',
            type: 'text',
        },
        {
            advanced: true,
            key: 'ariaLabel',
            label: 'Accessible label',
            type: 'text',
        },
        { key: 'rowspan', label: 'Row span', type: 'readonly' },
        { key: 'colspan', label: 'Column span', type: 'readonly' },
    ];
}

export function tableAttributeSuggestions(
    kind: TablePropertyKind,
    tagName: string,
): readonly AttributeSuggestion[] {
    const common = [
        { name: 'id' },
        { name: 'title' },
        { name: 'lang' },
        { name: 'dir', values: ['auto', 'ltr', 'rtl'] },
        { name: 'hidden', values: ['', 'hidden', 'until-found'] },
        { name: 'tabindex' },
        { name: 'contenteditable', values: ['false', 'true'] },
        { name: 'draggable', values: ['false', 'true'] },
        { name: 'spellcheck', values: ['false', 'true'] },
        { name: 'translate', values: ['no', 'yes'] },
        { name: 'role' },
        { name: 'aria-describedby' },
        { name: 'aria-labelledby' },
    ];
    if (kind === 'table')
        return [
            ...common,
            { name: 'aria-colcount' },
            { name: 'aria-rowcount' },
        ];
    if (kind === 'row')
        return [
            ...common,
            { name: 'aria-rowindex' },
            { name: 'aria-selected', values: ['true', 'false'] },
        ];
    if (kind === 'cell')
        return [
            ...common,
            { name: 'headers' },
            ...(tagName === 'th' ? [{ name: 'abbr' }] : []),
            { name: 'aria-colindex' },
            { name: 'aria-rowindex' },
            { name: 'aria-selected', values: ['true', 'false'] },
        ];
    return common;
}

export function managedTableAttributes(
    kind: TablePropertyKind,
): readonly string[] {
    if (kind === 'table') return ['aria-label', 'height', 'style', 'width'];
    if (kind === 'row') return ['aria-label', 'height', 'style'];
    if (kind === 'section') return ['style'];
    return [
        'aria-label',
        'colspan',
        'height',
        'rowspan',
        'scope',
        'style',
        'width',
    ];
}

export function tablePropertyOptionLabel(value: string): string {
    const labels: Readonly<Record<string, string>> = {
        baseline: 'Baseline',
        body: 'Body',
        bottom: 'Bottom',
        center: 'Center',
        col: 'Column',
        colgroup: 'Column group',
        foot: 'Footer',
        head: 'Header',
        left: 'Left',
        middle: 'Middle',
        right: 'Right',
        row: 'Row',
        rowgroup: 'Row group',
        top: 'Top',
    };
    return labels[value] ?? value;
}

export function createTableDimensionControl(
    document: Document,
    currentValue: string,
    translate: (message: string) => string,
    labelText: string,
    key: string,
): TableDimensionControl {
    const normalized = /^[1-9][0-9]{0,3}$/u.test(currentValue)
        ? `${currentValue}px`
        : currentValue;
    const wrapper = document.createElement('div');
    wrapper.className = 'soeditor-ui__field soeditor-table-properties__width';
    wrapper.dataset.tableField = key;
    const caption = document.createElement('span');
    caption.textContent = labelText;
    const custom = document.createElement('div');
    custom.className =
        'soeditor-ui__link-rel-custom soeditor-table-properties__custom-width';
    const amount = document.createElement('input');
    amount.type = 'number';
    amount.inputMode = 'numeric';
    amount.min = '1';
    amount.step = '1';
    amount.setAttribute('aria-label', labelText);
    const unit = document.createElement('select');
    unit.setAttribute('aria-label', `${labelText} unit`);
    for (const [optionValue, label] of [
        ['%', 'Percent'],
        ['px', 'Pixels'],
    ] as const) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = label;
        unit.append(option);
    }
    const parsed = /^(\d+)(px|%)$/u.exec(normalized);
    amount.value = parsed?.[1] ?? '';
    unit.value = parsed?.[2] ?? 'px';
    const feedback = document.createElement('small');
    feedback.className = 'soeditor-table-properties__feedback';
    const refresh = (): boolean => {
        feedback.hidden = amount.value.length === 0;
        if (amount.value.length === 0) {
            amount.setCustomValidity('');
            amount.setAttribute('aria-invalid', 'false');
            feedback.classList.remove('is-error');
            feedback.textContent = '';
            return true;
        }
        const maximum = unit.value === '%' ? 100 : 9999;
        amount.max = String(maximum);
        const numeric = Number(amount.value);
        const valid =
            /^\d+$/u.test(amount.value) &&
            Number.isInteger(numeric) &&
            numeric >= 1 &&
            numeric <= maximum;
        const message = translate(
            maximum === 100
                ? 'Enter a whole number from 1 to 100.'
                : 'Enter a whole number from 1 to 9999.',
        );
        amount.setCustomValidity(valid ? '' : message);
        amount.setAttribute('aria-invalid', String(!valid));
        feedback.classList.toggle('is-error', !valid);
        feedback.textContent = message;
        return valid;
    };
    amount.addEventListener('input', refresh);
    unit.addEventListener('change', refresh);
    custom.append(amount, unit);
    wrapper.append(caption, custom, feedback);
    refresh();
    return Object.freeze({
        element: wrapper,
        focus: () => amount.focus(),
        validate: () => {
            if (refresh()) return true;
            amount.reportValidity();
            return false;
        },
        value: () =>
            amount.value.length === 0
                ? ''
                : `${String(Number(amount.value))}${unit.value}`,
    });
}

const blocked = new Set(['is', 'nonce', 'srcdoc', 'style', 'xmlns']);

export function openTableCellHtmlDialog(
    document: Document,
    openDialog: (options: {
        readonly title: string;
        readonly content: HTMLElement;
        readonly actions: readonly {
            readonly kind: 'primary';
            readonly label: string;
            readonly run: () => void;
        }[];
    }) => { readonly element: HTMLElement; close(): void },
    initial: string,
    applyValue: (value: string) => boolean,
): void {
    const body = document.createElement('div');
    body.className = 'soeditor-table-cell-editor';
    const help = document.createElement('p');
    help.className = 'soeditor-table-cell-editor__help';
    help.textContent =
        'Edit the HTML inside this cell. Nested tables are not allowed.';
    const input = document.createElement('textarea');
    input.className = 'soeditor-table-context__editor';
    input.value = initial;
    input.rows = 6;
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Cell HTML');
    body.append(help, input);
    const apply = (): void => {
        if (applyValue(input.value)) dialog.close();
    };
    const dialog = openDialog({
        title: 'Edit cell HTML',
        content: body,
        actions: [{ kind: 'primary', label: 'Apply', run: apply }],
    });
    dialog.element.classList.add('soeditor-ui__link-dialog');
    input.addEventListener('keydown', (event) => {
        if (
            event.key !== 'Enter' ||
            event.isComposing ||
            (!event.ctrlKey && !event.metaKey)
        )
            return;
        event.preventDefault();
        apply();
    });
    input.focus();
    input.select();
}

export function readTableTagAttributes(
    value: unknown,
): readonly TableTagAttribute[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry: unknown) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const name = Reflect.get(entry, 'name');
        const attributeValue = Reflect.get(entry, 'value');
        return typeof name === 'string' && typeof attributeValue === 'string'
            ? [{ name, value: attributeValue }]
            : [];
    });
}

export function createTableTagAttributeEditor(
    document: Document,
    initial: readonly TableTagAttribute[],
    suggestions: readonly AttributeSuggestion[],
    managedNames: readonly string[],
): {
    readonly element: HTMLElement;
    value(): readonly TableTagAttribute[] | undefined;
} {
    const managed = new Set(managedNames);
    const supported = new Set(suggestions.map(({ name }) => name));
    const attributes = new Map(initial.map(({ name, value }) => [name, value]));
    const root = document.createElement('section');
    root.className = 'soeditor-table-attributes';
    const heading = document.createElement('strong');
    heading.textContent = '附加属性';
    const help = document.createElement('p');
    help.textContent = '仅允许当前标签适用的标准、ARIA 或 CMS data-* 属性。';
    const edit = document.createElement('div');
    edit.className = 'soeditor-ui__link-attribute-row';
    const name = inputField(document, '属性名');
    const value = inputField(document, '属性值');
    const names = document.createElement('datalist');
    names.id = `soeditor-table-attributes-${String(document.querySelectorAll('.soeditor-table-attributes').length)}`;
    for (const suggestion of suggestions) {
        const option = document.createElement('option');
        option.value = suggestion.name;
        names.append(option);
    }
    name.input.setAttribute('list', names.id);
    const values = document.createElement('datalist');
    values.id = `${names.id}-values`;
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'soeditor-ui__dialog-action';
    add.textContent = '添加属性';
    edit.append(name.label, value.label, add);
    const existing = document.createElement('div');
    existing.className = 'soeditor-ui__link-rel-custom';
    const selectLabel = document.createElement('label');
    selectLabel.className = 'soeditor-ui__field';
    const selectCaption = document.createElement('span');
    selectCaption.textContent = '已添加属性';
    const select = document.createElement('select');
    selectLabel.append(selectCaption, select);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'soeditor-ui__dialog-action is-danger';
    remove.textContent = '移除属性';
    existing.append(selectLabel, remove);
    root.append(heading, help, edit, existing, names, values);

    const updateSuggestions = (): void => {
        const candidates = suggestions.find(
            ({ name: candidate }) => candidate === name.input.value.trim(),
        )?.values;
        values.replaceChildren(
            ...(candidates ?? []).map((candidate) => {
                const option = document.createElement('option');
                option.value = candidate;
                return option;
            }),
        );
        if (candidates === undefined) value.input.removeAttribute('list');
        else value.input.setAttribute('list', values.id);
    };
    const render = (): void => {
        select.replaceChildren(
            ...Array.from(attributes, ([attributeName, attributeValue]) => {
                const option = document.createElement('option');
                option.value = attributeName;
                option.textContent = `${attributeName} = ${attributeValue || '""'}`;
                return option;
            }),
        );
        existing.hidden = attributes.size === 0;
    };
    const commit = (): boolean => {
        const attributeName = name.input.value.trim().toLowerCase();
        const valid =
            /^[a-z][a-z0-9_.:-]{0,63}$/u.test(attributeName) &&
            (supported.has(attributeName) ||
                /^data-[a-z0-9_.:-]+$/u.test(attributeName)) &&
            !managed.has(attributeName) &&
            !blocked.has(attributeName) &&
            !attributeName.startsWith('on') &&
            !attributeName.startsWith('data-soeditor-') &&
            (attributes.size < 32 || attributes.has(attributeName));
        name.input.setCustomValidity(
            valid ? '' : '此属性不适用于当前标签或已被专用字段管理。',
        );
        if (!name.input.reportValidity()) return false;
        const candidates = suggestions.find(
            ({ name: candidate }) => candidate === attributeName,
        )?.values;
        value.input.setCustomValidity(
            candidates !== undefined && !candidates.includes(value.input.value)
                ? '属性值无效。'
                : '',
        );
        if (!value.input.reportValidity()) return false;
        attributes.set(attributeName, value.input.value);
        name.input.value = value.input.value = '';
        updateSuggestions();
        render();
        return true;
    };
    name.input.addEventListener('input', updateSuggestions);
    add.addEventListener('click', commit);
    select.addEventListener('change', () => {
        name.input.value = select.value;
        value.input.value = attributes.get(select.value) ?? '';
        updateSuggestions();
    });
    remove.addEventListener('click', () => {
        attributes.delete(select.value);
        name.input.value = value.input.value = '';
        render();
    });
    render();
    return Object.freeze({
        element: root,
        value: () => {
            if (name.input.value.length > 0 && !commit()) return undefined;
            return Object.freeze(
                Array.from(attributes, ([name, value]) => ({ name, value })),
            );
        },
    });
}

function inputField(document: Document, caption: string) {
    const label = document.createElement('label');
    label.className = 'soeditor-ui__field';
    const text = document.createElement('span');
    text.textContent = caption;
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.maxLength = caption === '属性名' ? 64 : 4096;
    label.append(text, input);
    return { input, label };
}
