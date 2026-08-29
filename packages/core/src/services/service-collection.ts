/** Internal type brand that does not become an ordinary token property. */
declare const serviceType: unique symbol;

/** A typed identity for a cross-feature service. */
export interface ServiceToken<Service> {
    /** Stable service identity shared by registration and lookup. */
    readonly id: string;
    readonly [serviceType]?: (service: Service) => Service;
}

/** Public service capabilities owned by one editor. */
export interface ServiceCollection {
    /** Registers a service and rejects duplicate IDs. */
    register<Service>(token: ServiceToken<Service>, service: Service): void;
    register<Service>(id: string, service: Service): void;
    /** Explicitly inserts or replaces a service. */
    replace<Service>(token: ServiceToken<Service>, service: Service): void;
    replace<Service>(id: string, service: Service): void;
    /** Returns whether a service is registered. */
    has<Service>(key: string | ServiceToken<Service>): boolean;
    /** Gets a service or throws when absent. */
    get<Service>(token: ServiceToken<Service>): Service;
    get<Service = unknown>(id: string): Service;
    /** Gets a service when present. */
    tryGet<Service>(token: ServiceToken<Service>): Service | undefined;
    tryGet<Service = unknown>(id: string): Service | undefined;
    /** Removes a service and reports whether it existed. */
    unregister<Service>(key: string | ServiceToken<Service>): boolean;
}

/** Creates a typed service token with a stable string identity. */
export function createServiceToken<Service>(id: string): ServiceToken<Service> {
    return Object.freeze({ id });
}
