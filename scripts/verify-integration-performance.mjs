import { performance } from 'node:perf_hooks';
import { stdout } from 'node:process';

import {
    freezeCommentThread,
    mapCommentThread,
} from '../packages/comments/dist/index.js';
import { Editor } from '../packages/core/dist/index.js';
import { visualEditingServiceToken } from '../packages/engine/dist/index.js';
import { parseHtmlFragment } from '../packages/html/dist/index.js';
import {
    ProjectionCoordinatorPlugin,
    projectionCoordinatorServiceToken,
} from '../packages/projections/dist/index.js';
import { TablePlugin } from '../packages/rich-text/dist/index.js';
import { createEditorWorkspace } from '../packages/workspace/dist/index.js';

const budgets = Object.freeze({
    annotationMapping: 4_000,
    canonicalInput: 4_000,
    projectionUpdates: 4_000,
    recovery: 4_000,
    startupTeardown: 4_000,
    tableOperations: 4_000,
});

const metrics = Object.freeze({
    annotationMapping: measureAnnotationMapping(),
    canonicalInput: await measureCanonicalInput(),
    projectionUpdates: await measureProjectionUpdates(),
    recovery: await measureRecovery(),
    startupTeardown: await measureStartupTeardown(),
    tableOperations: await measureTableOperations(),
});

for (const [name, duration] of Object.entries(metrics)) {
    const budget = Reflect.get(budgets, name);
    if (typeof budget !== 'number' || duration > budget) {
        throw new Error(
            `${name} exceeded its integration budget: ${duration.toFixed(2)} ms > ${String(budget)} ms.`,
        );
    }
}

stdout.write(
    `Integration performance budgets passed: ${Object.entries(metrics)
        .map(([name, duration]) => `${name}=${duration.toFixed(2)}ms`)
        .join(', ')}.\n`,
);

async function measureCanonicalInput() {
    const editor = await Editor.create();
    const source = Array.from(
        { length: 5_000 },
        (_, index) =>
            `<p data-row="${String(index)}">Large document row ${String(index)}</p>`,
    ).join('');
    const started = performance.now();
    for (let index = 0; index < 20; index += 1) editor.setData(source);
    const duration = performance.now() - started;
    await editor.destroy();
    return duration;
}

async function measureProjectionUpdates() {
    const editor = await Editor.create({
        plugins: [ProjectionCoordinatorPlugin],
    });
    const service = editor.services.get(projectionCoordinatorServiceToken);
    let updates = 0;
    for (const id of ['visual', 'source', 'preview']) {
        service.attach({
            id,
            update: () => {
                updates += 1;
            },
        });
    }
    const started = performance.now();
    for (let index = 0; index < 200; index += 1) {
        editor.execute('projection.show', 'source');
        editor.execute(
            'projection.activate',
            index % 2 === 0 ? 'source' : 'visual',
        );
        editor.setReadonly(index % 2 === 0);
    }
    const duration = performance.now() - started;
    if (updates < 600)
        throw new Error(
            'Projection performance fixture did not update adapters.',
        );
    await editor.destroy();
    return duration;
}

function measureAnnotationMapping() {
    const threads = Array.from({ length: 500 }, (_, index) =>
        freezeCommentThread({
            createdAt: 1,
            id: `thread-${String(index)}`,
            messages: [
                {
                    author: { id: 'author', name: 'Author' },
                    body: 'Review',
                    createdAt: 1,
                    id: `message-${String(index)}`,
                },
            ],
            range: {
                from: { block: index, offset: 1 },
                to: { block: index, offset: 4 },
            },
            state: 'linked',
            updatedAt: 1,
        }),
    );
    const started = performance.now();
    for (let pass = 0; pass < 50; pass += 1) {
        for (const thread of threads) {
            mapCommentThread(
                thread,
                [
                    {
                        block: thread.range.from.block,
                        from: 2,
                        insertedLength: 1,
                        kind: 'replace-text',
                        to: 2,
                    },
                ],
                pass + 2,
            );
        }
    }
    return performance.now() - started;
}

async function measureTableOperations() {
    const source = `<table><tbody>${Array.from(
        { length: 20 },
        (_, row) =>
            `<tr>${Array.from({ length: 20 }, (_, column) => `<td>${String(row)}:${String(column)}</td>`).join('')}</tr>`,
    ).join('')}</tbody></table>`;
    const parsed = parseHtmlFragment(source).document.children[0];
    if (parsed?.type !== 'element')
        throw new Error('Table performance fixture failed to parse.');
    let block = {
        attributes: parsed.attributes,
        behavior: 'atomic',
        children: parsed.children,
        kind: 'structured-block',
        type: 'soeditor.table',
    };
    const editor = await Editor.create({ plugins: [TablePlugin] });
    editor.services.register(visualEditingServiceToken, {
        canEdit: () => true,
        getSelection: () => undefined,
        getSelectedStructuredBlock: () => block,
        insertHtml: () => undefined,
        isBlockActive: () => false,
        isLinkActive: () => false,
        isListActive: () => false,
        isMarkActive: () => false,
        isStructuredBlockSelected: () => true,
        replaceStructuredBlockContent: (_type, content) => {
            block = { ...block, ...content };
        },
        setBlock: () => undefined,
        setLink: () => undefined,
        setSelection: () => false,
        setStructuredBlockAttributes: () => undefined,
        toggleList: () => undefined,
        toggleMark: () => undefined,
    });
    const started = performance.now();
    for (let index = 0; index < 100; index += 1) {
        editor.execute(
            'table.cell.setText',
            {
                anchor: { column: index % 20, row: Math.floor(index / 20) },
                focus: { column: index % 20, row: Math.floor(index / 20) },
            },
            `updated-${String(index)}`,
        );
    }
    const duration = performance.now() - started;
    await editor.destroy();
    return duration;
}

async function measureStartupTeardown() {
    const started = performance.now();
    for (let index = 0; index < 100; index += 1) {
        const editor = await Editor.create({ data: `<p>${String(index)}</p>` });
        await editor.destroy();
    }
    return performance.now() - started;
}

async function measureRecovery() {
    const workspace = await createEditorWorkspace({
        createEditor: ({ source }) => Editor.create({ data: source }),
        recovery: { maxRestarts: 10, windowMs: 60_000 },
        value: { initialValue: '<p>Recovery</p>', kind: 'uncontrolled' },
    });
    const started = performance.now();
    for (let index = 0; index < 10; index += 1) {
        await workspace.reportFailure(new Error(`failure-${String(index)}`));
    }
    const duration = performance.now() - started;
    await workspace.destroy();
    return duration;
}
