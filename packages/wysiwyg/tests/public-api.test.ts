import { describe, expect, it } from 'vitest';

import { createWysiwygEditingEngine } from '../src/index.js';

describe('@soeditor/wysiwyg public API', () => {
    it('exports the dedicated WYSIWYG engine factory', () => {
        expect(createWysiwygEditingEngine).toBeTypeOf('function');
    });
});
