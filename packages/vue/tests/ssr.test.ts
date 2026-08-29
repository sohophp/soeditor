import { Editor } from '@soeditor/core';
import { renderToString } from '@vue/server-renderer';
import { createSSRApp, defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';

import { useSoEditorWorkspace } from '../src/index.js';

describe('Vue Workspace adapter', () => {
    it('renders on the server without creating an Editor or reading DOM', async () => {
        let creates = 0;
        const Example = defineComponent({
            setup() {
                const result = useSoEditorWorkspace({
                    createEditor: ({ source }) => {
                        creates += 1;
                        return Editor.create({ data: source });
                    },
                    initialValue: '<p>SSR</p>',
                });
                return () => h('output', result.status.value);
            },
        });

        expect(await renderToString(createSSRApp(Example))).toBe(
            '<output>idle</output>',
        );
        expect(creates).toBe(0);
    });
});
