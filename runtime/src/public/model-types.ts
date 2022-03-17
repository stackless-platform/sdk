import {requiresTruthy} from "../internal/util/requires.js";
import {DataRegistry} from "../internal/util/registry.js";
import {DataKey} from "../internal/internal-model-types.js";
import {__wetag, __wopk, __wspk} from "../internal/symbol.js";

export class Service {
    [__wspk]: string;

    constructor(primaryKey: string) {
        requiresTruthy('primaryKey', primaryKey);
        this[__wspk] = primaryKey;
    }

    get primaryKey(): string {
        return this[__wspk];
    }
}

export type ServiceConstructor<T extends Service> = new(primaryKey: string) => T;

export class Message {
    [__wetag]: true;
}

export type MessageConstructor<T extends Message> = new() => T;

export class Data {
    [__wopk]: string;

    constructor(primaryKey: string) {
        requiresTruthy('primaryKey', primaryKey);
        DataRegistry.instance.setInstance(new DataKey(DataRegistry.instance.getClassKey(this.constructor), primaryKey), this);
        this[__wopk] = primaryKey;
    }

    get primaryKey(): string {
        return this[__wopk];
    }
}

export type DataConstructor<T extends Data> = new(...any: any) => T;

export type DataUpdateListener = (e: DataUpdatedEvent) => Promise<void> | void;

export type MessageListener = (e: Message) => Promise<void> | void;

export class DataUpdatedEvent {
    constructor(public readonly target: Data, public readonly deleted: boolean) {
    }
}