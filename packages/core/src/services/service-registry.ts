import {
    ServiceAlreadyRegisteredError,
    ServiceNotFoundError,
} from '../errors/errors.js';
import type { ServiceCollection, ServiceToken } from './service-collection.js';

type ServiceKey<Service = unknown> = string | ServiceToken<Service>;

interface ServiceRegistryRecord {
    readonly assertAvailable: () => void;
    readonly services: Map<string, unknown>;
}

const records = new WeakMap<ServiceRegistry, ServiceRegistryRecord>();

function serviceId<Service>(key: ServiceKey<Service>): string {
    return typeof key === 'string' ? key : key.id;
}

/** @internal Per-editor service storage. */
export class ServiceRegistry implements ServiceCollection {
    constructor(assertAvailable: () => void) {
        records.set(this, { assertAvailable, services: new Map() });
    }

    register<Service>(token: ServiceToken<Service>, service: Service): void;
    register<Service>(id: string, service: Service): void;
    register<Service>(key: ServiceKey<Service>, service: Service): void {
        const record = getRecord(this);
        record.assertAvailable();
        const id = serviceId(key);

        if (record.services.has(id)) {
            throw new ServiceAlreadyRegisteredError(id);
        }

        record.services.set(id, service);
    }

    replace<Service>(token: ServiceToken<Service>, service: Service): void;
    replace<Service>(id: string, service: Service): void;
    replace<Service>(key: ServiceKey<Service>, service: Service): void {
        const record = getRecord(this);
        record.assertAvailable();
        record.services.set(serviceId(key), service);
    }

    has<Service>(key: ServiceKey<Service>): boolean {
        const record = getRecord(this);
        record.assertAvailable();
        return record.services.has(serviceId(key));
    }

    get<Service>(token: ServiceToken<Service>): Service;
    get<Service = unknown>(id: string): Service;
    get<Service>(key: ServiceKey<Service>): Service {
        const record = getRecord(this);
        record.assertAvailable();
        const id = serviceId(key);

        if (!record.services.has(id)) {
            throw new ServiceNotFoundError(id);
        }

        return record.services.get(id) as Service;
    }

    tryGet<Service>(token: ServiceToken<Service>): Service | undefined;
    tryGet<Service = unknown>(id: string): Service | undefined;
    tryGet<Service>(key: ServiceKey<Service>): Service | undefined {
        const record = getRecord(this);
        record.assertAvailable();
        return record.services.get(serviceId(key)) as Service | undefined;
    }

    unregister<Service>(key: ServiceKey<Service>): boolean {
        const record = getRecord(this);
        record.assertAvailable();
        return record.services.delete(serviceId(key));
    }
}

function getRecord(registry: ServiceRegistry): ServiceRegistryRecord {
    const record = records.get(registry);

    if (record === undefined) {
        throw new Error('Service registry storage is unavailable.');
    }

    return record;
}

/** @internal Clears services without exposing cleanup to consumers. */
export function clearServices(registry: ServiceRegistry): void {
    getRecord(registry).services.clear();
}
