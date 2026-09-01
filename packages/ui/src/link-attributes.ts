interface LinkCustomAttributeValue {
    readonly name: string;
    readonly value: string;
}

interface LinkAttributeSuggestion {
    readonly name: string;
    readonly values?: readonly string[];
}

const managedNames = new Set(['href', 'rel', 'target', 'title']);
const blockedNames = new Set(['is', 'nonce', 'srcdoc', 'style', 'xmlns']);
export function readInspectedCustomAttributes(
    values: Record<string, unknown>,
): readonly LinkCustomAttributeValue[] {
    if (!Array.isArray(values.customAttributes)) return [];
    return values.customAttributes.flatMap((entry: unknown) => {
        const name =
            typeof entry === 'object' && entry !== null
                ? Reflect.get(entry, 'name')
                : undefined;
        const value =
            typeof entry === 'object' && entry !== null
                ? Reflect.get(entry, 'value')
                : undefined;
        return typeof name === 'string' && typeof value === 'string'
            ? [{ name, value }]
            : [];
    });
}

export function linkCustomAttributeField(
    document: Document,
    container: HTMLElement,
    initial: readonly LinkCustomAttributeValue[],
    suggestionsValue: unknown,
    translate: (message: string) => string,
): {
    readonly value: () => readonly LinkCustomAttributeValue[] | undefined;
} {
    const suggestions: readonly LinkAttributeSuggestion[] = Array.isArray(
        suggestionsValue,
    )
        ? suggestionsValue.flatMap((entry: unknown) => {
              if (typeof entry !== 'object' || entry === null) return [];
              const name = Reflect.get(entry, 'name');
              const values: unknown = Reflect.get(entry, 'values');
              return typeof name === 'string' &&
                  (values === undefined ||
                      (Array.isArray(values) &&
                          values.every(
                              (value): value is string =>
                                  typeof value === 'string',
                          )))
                  ? [{ name, ...(values === undefined ? {} : { values }) }]
                  : [];
          })
        : [];
    const supportedNames = new Set(suggestions.map(({ name }) => name));
    const attributes = new Map(initial.map(({ name, value }) => [name, value]));
    const suffix = String(
        document.querySelectorAll('.soeditor-ui__link-attributes').length,
    );
    const prefix = `soeditor-link-attribute-${suffix}`;
    const section = document.createElement('section');
    section.className = 'soeditor-ui__link-attributes';
    // This is a closed, static UI template. User values are added below with
    // DOM text/value properties and never interpolated into markup.
    section.innerHTML = `
<div><strong>Additional attributes</strong><p>Add standard or CMS attributes. Reserved names are blocked.</p></div>
<div class="soeditor-ui__link-attribute-row">
<label class="soeditor-ui__field"><span>Attribute name</span><input data-role="name" aria-label="Attribute name" list="${prefix}-names" maxlength="64" autocomplete="off" placeholder="Choose or enter an attribute name"></label>
<label class="soeditor-ui__field"><span>Attribute value</span><input data-role="value" aria-label="Attribute value" maxlength="4096" autocomplete="off"></label>
<button data-role="add" type="button" class="soeditor-ui__dialog-action">Add attribute</button>
</div>
<div class="soeditor-ui__link-rel-custom">
<label class="soeditor-ui__field"><span>Added attributes</span><select data-role="list"></select></label>
<button data-role="remove" type="button" class="soeditor-ui__dialog-action is-danger">Remove attribute</button>
</div>
<p data-role="empty" class="soeditor-ui__link-attributes-empty">No additional attributes.</p>
<datalist id="${prefix}-names"></datalist><datalist id="${prefix}-values"></datalist>`;
    const name = required<HTMLInputElement>(section, '[data-role="name"]');
    const value = required<HTMLInputElement>(section, '[data-role="value"]');
    const add = required<HTMLButtonElement>(section, '[data-role="add"]');
    const list = required<HTMLSelectElement>(section, '[data-role="list"]');
    const listControls = required<HTMLElement>(
        section,
        '.soeditor-ui__link-rel-custom',
    );
    const remove = required<HTMLButtonElement>(section, '[data-role="remove"]');
    const empty = required<HTMLElement>(section, '[data-role="empty"]');
    const nameSuggestions = required<HTMLDataListElement>(
        section,
        `#${prefix}-names`,
    );
    const valueSuggestions = required<HTMLDataListElement>(
        section,
        `#${prefix}-values`,
    );
    for (const suggestion of suggestions) {
        const option = document.createElement('option');
        option.value = suggestion.name;
        nameSuggestions.append(option);
    }
    name.spellcheck = false;
    container.append(section);

    const render = (): void => {
        list.replaceChildren(
            ...Array.from(attributes, ([attributeName, attributeValue]) => {
                const option = document.createElement('option');
                option.value = attributeName;
                option.textContent = `${attributeName} = ${attributeValue || '""'}`;
                return option;
            }),
        );
        empty.hidden = attributes.size > 0;
        listControls.hidden = attributes.size === 0;
    };
    const updateValueSuggestions = (): void => {
        const values = suggestions.find(
            ({ name: candidate }) => candidate === name.value.trim(),
        )?.values;
        valueSuggestions.replaceChildren(
            ...(values ?? []).map((candidate) => {
                const option = document.createElement('option');
                option.value = candidate;
                return option;
            }),
        );
        if (values === undefined) value.removeAttribute('list');
        else value.setAttribute('list', valueSuggestions.id);
    };
    const commit = (): boolean => {
        const attributeName = name.value.trim().toLowerCase();
        const supported =
            supportedNames.has(attributeName) ||
            /^data-[a-z0-9_.:-]+$/u.test(attributeName);
        const invalid =
            !/^[a-z][a-z0-9_.:-]{0,63}$/u.test(attributeName) ||
            managedNames.has(attributeName) ||
            blockedNames.has(attributeName) ||
            attributeName.startsWith('on') ||
            attributeName.startsWith('data-soeditor-') ||
            !supported ||
            (attributes.size >= 32 && !attributes.has(attributeName));
        name.setCustomValidity(invalid ? translate('Invalid attribute.') : '');
        if (!name.reportValidity()) return false;
        const listedValues = suggestions.find(
            ({ name: candidate }) => candidate === attributeName,
        )?.values;
        value.setCustomValidity(
            listedValues !== undefined && !listedValues.includes(value.value)
                ? translate('Invalid attribute.')
                : '',
        );
        if (!value.reportValidity()) return false;
        attributes.set(attributeName, value.value);
        name.value = value.value = '';
        updateValueSuggestions();
        render();
        return true;
    };
    name.addEventListener('input', () => {
        name.setCustomValidity('');
        updateValueSuggestions();
    });
    value.addEventListener('input', () => value.setCustomValidity(''));
    name.addEventListener('change', () => {
        name.value = name.value.trim().toLowerCase();
        updateValueSuggestions();
    });
    add.addEventListener('click', commit);
    list.addEventListener('change', () => {
        name.value = list.value;
        value.value = attributes.get(list.value) ?? '';
        updateValueSuggestions();
        name.focus();
    });
    remove.addEventListener('click', () => {
        attributes.delete(list.value);
        name.value = value.value = '';
        updateValueSuggestions();
        render();
    });
    render();

    return {
        value: () => {
            if (name.value.length > 0 && !commit()) return undefined;
            return Object.freeze(
                Array.from(attributes, ([name, value]) => ({ name, value })),
            );
        },
    };
}

function required<T extends Element>(root: Element, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (element === null) throw new Error('Link attribute UI is incomplete.');
    return element;
}
