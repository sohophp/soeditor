import {
    Config,
    CyclicConfigurationError,
    Editor,
    UnsupportedConfigValueError,
} from '../src/index';

describe('Config', () => {
    it('gets values and nested dotted paths', () => {
        const config = new Config({
            language: 'en',
            preview: { css: ['content.css'], enabled: false },
        });

        expect(config.has('language')).toBe(true);
        expect(config.get<string>('language')).toBe('en');
        expect(config.get<readonly string[]>('preview.css')).toEqual([
            'content.css',
        ]);
        expect(config.has('preview.enabled')).toBe(true);
        expect(config.get('preview.enabled')).toBe(false);
    });

    it('returns absent for invalid and empty paths', () => {
        const config = new Config({ preview: true });

        expect(config.has('')).toBe(false);
        expect(config.get('missing')).toBeUndefined();
        expect(config.get('preview.css')).toBeUndefined();
    });

    it('defensively copies and freezes nested input', async () => {
        const input = {
            preview: {
                css: ['before.css'],
            },
        };
        const editor = await Editor.create({ config: input });
        input.preview.css[0] = 'after.css';
        input.preview.css.push('extra.css');

        const value = editor.config.get<readonly string[]>('preview.css');
        expect(value).toEqual(['before.css']);
        expect(Object.isFrozen(value)).toBe(true);
    });

    it('supports null-prototype records', () => {
        const values = Object.create(null) as Record<string, unknown>;
        values.value = 1;
        const config = new Config(values);

        expect(config.get('value')).toBe(1);
    });

    it.each([
        ['Date', new Date()],
        ['Map', new Map()],
        ['Set', new Set()],
        ['function', () => undefined],
        ['undefined', undefined],
    ])('rejects unsupported %s values', (_kind, value) => {
        expect(() => new Config({ value })).toThrow(
            UnsupportedConfigValueError,
        );
    });

    it('rejects cyclic configuration with a descriptive path', () => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;

        expect(() => new Config({ cyclic })).toThrow(
            new CyclicConfigurationError('config.cyclic.self'),
        );
    });

    it('rejects accessors and symbol-keyed configuration', () => {
        const accessor: Record<string, unknown> = {};
        Object.defineProperty(accessor, 'value', {
            enumerable: true,
            get: () => 'computed',
        });
        const symbolKeyed: Record<string, unknown> = {};
        Object.defineProperty(symbolKeyed, Symbol('value'), {
            enumerable: true,
            value: 'hidden',
        });

        expect(() => new Config({ accessor })).toThrow(
            UnsupportedConfigValueError,
        );
        expect(() => new Config({ symbolKeyed })).toThrow(
            UnsupportedConfigValueError,
        );
    });

    it('rejects non-enumerable configuration accessors without invoking them', () => {
        let reads = 0;
        const values: Record<string, unknown> = {};
        Object.defineProperty(values, 'hidden', {
            enumerable: false,
            get: () => {
                reads += 1;
                return 'value';
            },
        });

        expect(() => new Config(values)).toThrow(UnsupportedConfigValueError);
        expect(reads).toBe(0);
    });

    it('accepts and defensively freezes dense ordinary arrays', () => {
        const input = [['first'], ['second']];
        const config = new Config({ input });
        input[0]?.push('mutated');

        const copied = config.get<readonly (readonly string[])[]>('input');
        expect(copied).toEqual([['first'], ['second']]);
        expect(Object.isFrozen(copied)).toBe(true);
        expect(Object.isFrozen(copied?.[0])).toBe(true);
    });

    it('rejects array accessors without invoking them', () => {
        let reads = 0;
        const input: unknown[] = ['initial'];
        Object.defineProperty(input, '0', {
            enumerable: true,
            get: () => {
                reads += 1;
                return 'computed';
            },
        });

        expect(() => new Config({ input })).toThrow(
            UnsupportedConfigValueError,
        );
        expect(reads).toBe(0);
    });

    it('rejects symbol and custom string properties on arrays', () => {
        const symbolKeyed: unknown[] = [];
        Object.defineProperty(symbolKeyed, Symbol('extra'), { value: true });
        const custom = [] as unknown[] & { extra?: boolean };
        custom.extra = true;

        expect(() => new Config({ symbolKeyed })).toThrow(
            UnsupportedConfigValueError,
        );
        expect(() => new Config({ custom })).toThrow(
            UnsupportedConfigValueError,
        );
    });

    it('rejects unsupported nested array values and cyclic arrays', () => {
        const cyclic: unknown[] = [];
        cyclic.push(cyclic);

        expect(() => new Config({ input: [new Date()] })).toThrow(
            UnsupportedConfigValueError,
        );
        expect(() => new Config({ cyclic })).toThrow(CyclicConfigurationError);
    });

    it('rejects sparse arrays explicitly', () => {
        const sparse = new Array<unknown>(1);

        expect(() => new Config({ sparse })).toThrow(
            UnsupportedConfigValueError,
        );
    });
});
