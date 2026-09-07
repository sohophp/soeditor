import { describe, expect, it } from 'vitest';
import { countCodePoints, countTextUnits } from '../src/document-statistics.js';

describe('document statistics units', () => {
    it('separates CJK characters from Latin words without locale dictionaries', () => {
        expect(countTextUnits('Hello世界!')).toBe(3);
        expect(countTextUnits("中文 don't stop 42 😀")).toBe(5);
        expect(countTextUnits('かなカナ')).toBe(4);
        expect(countTextUnits('é e\u0301cole')).toBe(2);
        expect(countTextUnits(' \n…😀')).toBe(0);
    });
    it('counts Unicode code points rather than UTF-16 units', () => {
        expect(countCodePoints('😀 e\u0301 &')).toBe(6);
    });
});
