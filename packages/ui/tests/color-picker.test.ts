import { describe, expect, it } from 'vitest';
import {
    formatPickerColor,
    hsvaToRgba,
    rgbaToHsva,
    serializePickerColor,
} from '../src/color-picker.js';

describe('color spectrum conversion', () => {
    it('round trips primary colors, grayscale, and low-brightness colors without truncation', () => {
        for (const [r = 0, g = 0, b = 0] of [
            [255, 0, 0],
            [0, 255, 0],
            [0, 0, 255],
            [0, 0, 0],
            [255, 255, 255],
            [127, 127, 127],
            [3, 8, 15],
            [18, 52, 86],
        ]) {
            expect(hsvaToRgba(rgbaToHsva(r, g, b, 0.5))).toEqual([
                r,
                g,
                b,
                0.5,
            ]);
        }
    });
    it('serializes opaque colors as hex and preserves alpha for the editing command', () => {
        expect(serializePickerColor(rgbaToHsva(18, 52, 86))).toBe('#123456');
        expect(serializePickerColor(rgbaToHsva(18, 52, 86, 0.375))).toBe(
            'rgba(18, 52, 86, 0.375)',
        );
        expect(serializePickerColor(rgbaToHsva(18, 52, 86, 0))).toBe(
            'rgba(18, 52, 86, 0)',
        );
    });
    it('formats HEXA, RGBA and HSVA with transparency', () => {
        const color = rgbaToHsva(102, 153, 204, 0.25);
        expect(formatPickerColor(color, 'HEXA')).toBe('#6699CC40');
        expect(formatPickerColor(color, 'RGBA')).toBe(
            'rgba(102, 153, 204, 0.25)',
        );
        expect(formatPickerColor(color, 'HSVA')).toBe(
            'hsva(210, 50%, 80%, 0.25)',
        );
    });
    it('wraps hue and clamps channels to CSS color bounds', () => {
        expect(hsvaToRgba({ h: 360, s: 1, v: 1, a: 2 })).toEqual([
            255, 0, 0, 1,
        ]);
        expect(hsvaToRgba({ h: -120, s: 1, v: 1, a: -1 })).toEqual([
            0, 0, 255, 0,
        ]);
        expect(rgbaToHsva(-1, 300, 0).s).toBe(1);
    });
});
