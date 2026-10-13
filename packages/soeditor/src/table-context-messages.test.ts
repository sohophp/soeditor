import { describe, expect, it } from 'vitest';
import { resolveUiTranslation } from '@soeditor/ui';
import { translateTableContextMessage } from './table-context-messages.js';

describe('table context messages', () => {
    it('normalizes service diagnostics per locale without changing technical data', () => {
        const coverage = '列组覆盖 2 列，但表格有 3 个逻辑列。';
        expect(
            translateTableContextMessage(
                coverage,
                resolveUiTranslation('en').translate,
            ),
        ).toBe(
            'Column groups cover 2 columns, but the table has 3 logical columns.',
        );
        expect(
            translateTableContextMessage(
                coverage,
                resolveUiTranslation('zh-TW').translate,
            ),
        ).toBe('欄群組涵蓋 2 欄，但表格有 3 個邏輯欄。');
        expect(
            translateTableContextMessage(
                '列组包含无效的 span。',
                resolveUiTranslation('en').translate,
            ),
        ).toBe('The column group contains an invalid span.');
        expect(
            translateTableContextMessage(
                '列组包含无效的 span。',
                resolveUiTranslation('zh-CN').translate,
            ),
        ).toBe('列组包含无效的 span。');
        expect(
            translateTableContextMessage(
                'API: unknown attribute x-cms',
                resolveUiTranslation('zh-TW').translate,
            ),
        ).toBe('API: unknown attribute x-cms');
    });
});
