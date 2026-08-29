import { Editor } from '@soeditor/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useSoEditorWorkspace } from '../src/index.js';

describe('React Workspace adapter', () => {
    it('renders on the server without creating an Editor or reading DOM', () => {
        let creates = 0;
        function Example() {
            const result = useSoEditorWorkspace({
                createEditor: ({ source }) => {
                    creates += 1;
                    return Editor.create({ data: source });
                },
                initialValue: '<p>SSR</p>',
            });
            return <output>{result.status}</output>;
        }

        expect(renderToString(<Example />)).toBe('<output>idle</output>');
        expect(creates).toBe(0);
    });
});
