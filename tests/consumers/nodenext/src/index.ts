import {
    Editor,
    Plugin,
    createServiceToken,
    type Transaction,
} from '@soeditor/core';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlElement,
} from '@soeditor/html';

interface ExampleService {
    readonly value: string;
}

const ExampleServiceToken = createServiceToken<ExampleService>('example');

class ConsumerPlugin extends Plugin {
    static readonly id = 'consumer';

    override init(): void {
        this.editor.commands.register({
            id: 'consumer.replace',
            execute: ({ editor }, source) => {
                editor.update(
                    (transaction: Transaction) => {
                        transaction.replaceDocument(String(source));
                    },
                    { origin: 'command' },
                );
            },
        });
    }
}

const editor = await Editor.create({
    config: { nested: { enabled: true } },
    data: '<p>NodeNext</p>',
    plugins: [ConsumerPlugin],
});

editor.services.register(ExampleServiceToken, { value: 'available' });
editor.execute('consumer.replace', '<p>Compiled</p>');
const serviceValue: string = editor.services.get(ExampleServiceToken).value;

if (serviceValue.length === 0) {
    throw new Error('Typed service lookup returned an invalid value.');
}

const htmlResult = parseHtmlFragment(
    '<product-card data-id="123">Content</product-card>',
);
const firstHtmlNode = htmlResult.document.children[0];

if (firstHtmlNode?.type !== 'element') {
    throw new Error('Packed HTML package returned an unexpected tree.');
}

const htmlElement: HtmlElement = firstHtmlNode;
const serializedHtml: string = serializeHtmlFragment(htmlResult.document);

if (
    htmlElement.tagName !== 'product-card' ||
    !serializedHtml.includes('data-id="123"')
) {
    throw new Error('Packed HTML package failed semantic preservation.');
}

// @ts-expect-error Cleanup is owned by Editor.destroy().
editor.commands.clear();
// @ts-expect-error Plugin lifecycle is not a consumer capability.
editor.plugins.destroy();
// @ts-expect-error Cleanup is owned by Editor.destroy().
editor.services.clear();
// @ts-expect-error Cleanup is owned by Editor.destroy().
editor.events.clear();
// @ts-expect-error Event publication is owned by core infrastructure.
editor.events.emit('editor:ready', { editor });

await editor.destroy();
