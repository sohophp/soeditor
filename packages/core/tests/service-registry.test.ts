import {
    createServiceToken,
    ServiceAlreadyRegisteredError,
    ServiceNotFoundError,
} from '../src/index';
import {
    clearServices,
    ServiceRegistry,
} from '../src/services/service-registry.js';

describe('ServiceRegistry', () => {
    it('registers and gets typed-token services', () => {
        const registry = new ServiceRegistry(() => undefined);
        const token = createServiceToken<{ value: number }>('example');
        const service = { value: 1 };

        registry.register(token, service);

        expect(registry.has(token)).toBe(true);
        expect(registry.get(token)).toBe(service);
        expect(registry.tryGet(token)?.value).toBe(1);
        expect(Object.isFrozen(token)).toBe(true);
    });

    it('supports string services and unregister', () => {
        const registry = new ServiceRegistry(() => undefined);
        registry.register('example', 1);

        expect(registry.get<number>('example')).toBe(1);
        expect(registry.unregister('example')).toBe(true);
        expect(registry.unregister('example')).toBe(false);
        expect(registry.tryGet('example')).toBeUndefined();
    });

    it('rejects duplicate IDs across strings and tokens', () => {
        const registry = new ServiceRegistry(() => undefined);
        const token = createServiceToken<number>('example');
        registry.register('example', 1);

        expect(() => registry.register(token, 2)).toThrow(
            ServiceAlreadyRegisteredError,
        );
    });

    it('reports missing services', () => {
        const registry = new ServiceRegistry(() => undefined);

        expect(registry.has('missing')).toBe(false);
        expect(registry.tryGet('missing')).toBeUndefined();
        expect(() => registry.get('missing')).toThrow(
            new ServiceNotFoundError('missing'),
        );
    });

    it('only overwrites through explicit replace', () => {
        const registry = new ServiceRegistry(() => undefined);
        const token = createServiceToken<number>('example');

        registry.replace(token, 1);
        registry.replace('example', 2);

        expect(registry.get(token)).toBe(2);
        clearServices(registry);
        expect(registry.has(token)).toBe(false);
    });
});
