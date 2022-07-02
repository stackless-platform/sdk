import {requiresTruthy} from "../internal/util/requires.js";
import {DataRegistry} from "../internal/util/registry.js";
import {DataKey} from "../internal/internal-model-types.js";
import {__Message_Tag, __Data_Primary_Key, __Service_Primary_Key} from "../internal/symbol.js";

export class Service {
    [__Service_Primary_Key]: string;

    constructor(primaryKey: string) {
        requiresTruthy('primaryKey', primaryKey);
        this[__Service_Primary_Key] = primaryKey;
    }

    get primaryKey(): string {
        return this[__Service_Primary_Key];
    }
}

export type ServiceConstructor<T extends Service> = new(primaryKey: string) => T;

export class Message {
    [__Message_Tag]!: true;
}

export type MessageConstructor<T extends Message> = new() => T;

export class Data {
    [__Data_Primary_Key]: string;

    constructor(primaryKey: string) {
        requiresTruthy('primaryKey', primaryKey);
        DataRegistry.instance.setInstance(new DataKey(DataRegistry.instance.getClassKey(this.constructor), primaryKey), this);
        this[__Data_Primary_Key] = primaryKey;
    }

    get primaryKey(): string {
        return this[__Data_Primary_Key];
    }
}

export type DataConstructor<T extends Data> = new(...any: any) => T;

export type DataUpdateListener = (e: DataUpdatedEvent) => Promise<void> | void;

export type MessageListener = (e: Message) => Promise<void> | void;

export class DataUpdatedEvent {
    constructor(public readonly target: Data, public readonly deleted: boolean) {
    }
}