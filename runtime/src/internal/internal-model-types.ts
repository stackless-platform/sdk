import {Unsigned} from "./util/unsigned.js";
import {requiresPositiveUnsigned, requiresTruthy} from "./util/requires.js";
import {logVerbose, sysLogError} from "./util/logging.js";
import {MessageRegistry, DataRegistry, WarpRegistry, ServiceRegistry} from "./util/registry.js";
import {Code} from "./code.js";

import {CallServiceMethodResponseProto} from "./protocol/call-service-method-response-proto.js";
import {SaveDataResponseProto} from "./protocol/save-data-response-proto.js";
import {SubscribeMessageResponseProto} from "./protocol/subscribe-message-response-proto.js";
import {UnsubscribeDataUpdatesResponseProto} from "./protocol/unsubscribe-data-updates-response-proto.js";
import {UnsubscribeMessageResponseProto} from "./protocol/unsubscribe-message-response-proto.js";
import {ConsoleLogProto} from "./protocol/console-log-proto.js";
import {GetDataResponseProto} from "./protocol/get-data-response-proto.js";
import {UserMessageUnionWrapperProto} from "./protocol/user-message-union-wrapper-proto.js";
import {SubscribeDataUpdatesResponseProto} from "./protocol/subscribe-data-updates-response-proto.js";
import {WarpReferenceUnionProto} from "./protocol/warp-reference-union-proto.js";
import {Message, Data} from "../public/model-types.js";
import {__wopk} from "./symbol.js";

export type WarpIdString = string;
export type WarpVersionString = string;
export type DataVersion = Unsigned;
export type DataKeyString = string;
export type ServiceKeyString = string;
export type ClassKeyString = string;
export type WarpKeyString = string;
export type ClassId = number;
export type MethodId = number;

export function createMessageInstance(classKey: MessageClassKey): Message {
    requiresTruthy('classKey', classKey);
    const ctor = MessageRegistry.instance.getCtor(classKey);

    const event = {};

    if (!Reflect.setPrototypeOf(event, ctor.prototype))
        throw new Error(sysLogError(`Failed to set the prototype of ${classKey.getFullyQualifiedName()}`));

    return <Message>event;
}

export function createDataInstance(objectKey: DataKey): Data {
    requiresTruthy('objectKey', objectKey);

    const ctor = DataRegistry.instance.getCtor(objectKey.classKey);

    const object = {
        [__wopk]: objectKey.primaryKey
    };

    if (!Reflect.setPrototypeOf(object, ctor.prototype))
        throw new Error(sysLogError(`Failed to set the prototype of ${objectKey.classKey.getFullyQualifiedName()}`));

    return <Data>object;
}


export interface IKey {
    value: string;

    getName(): string;

    getFullyQualifiedName(): string;
}

export class KeySet<TK extends IKey> {
    private _set = new Set<string>();

    public size() {
        return this._set.size;
    }

    public has(key: TK): boolean {
        requiresTruthy('key', key);
        return this._set.has(key.value);
    }

    public add(key: TK): boolean {
        requiresTruthy('key', key);
        if (!this._set.has(key.value)) {
            this._set.add(key.value);
            return true;
        }
        return false;
    }

    public delete(key: TK) {
        requiresTruthy('key', key);
        this._set.delete(key.value);
    }

    public clear() {
        this._set.clear();
    }

    public keys(): IterableIterator<string> {
        return this._set.keys();
    }

    public values(): IterableIterator<string> {
        return this._set.values();
    }
}

export class KeyMap<TK extends IKey, TV> {
    private _map = new Map<string, TV>();

    public size() {
        return this._map.size;
    }

    public get(key: TK): TV {
        requiresTruthy('key', key);
        const value = this._map.get(key.value);
        if (!value) {
            console.log("_map: " + JSON.stringify(this._map));
            throw new Error(sysLogError(`KeyMap: Unable to find value by key ${key.value}`));
        }
        return value;
    }

    public tryGet(key: TK): TV | undefined {
        requiresTruthy('key', key);
        return this._map.get(key.value);
    }

    public has(key: TK): boolean {
        requiresTruthy('key', key);
        return this._map.has(key.value);
    }

    public trySet(key: TK, value: TV): boolean {
        requiresTruthy('key', key);
        if (!this._map.has(key.value)) {
            this._map.set(key.value, value);
            return true;
        }
        return false;
    }

    public set(key: TK, value: TV) {
        requiresTruthy('key', key);
        this._map.set(key.value, value);
    }

    public delete(key: TK) {
        requiresTruthy('key', key);
        this._map.delete(key.value);
    }

    public clear() {
        this._map.clear();
    }

    public keys(): IterableIterator<string> {
        return this._map.keys();
    }

    public values(): IterableIterator<TV> {
        return this._map.values();
    }
}

export class DataMap<TV> {
    private _map = new Map<Data, TV>();

    public clear() {
        this._map.clear();
    }

    public size() {
        return this._map.size;
    }

    public get(key: Data): TV {
        requiresTruthy('key', key);
        const value = this._map.get(key);
        if (!value)
            throw new Error(sysLogError(`DataMap: Unable to find value by key ${JSON.stringify(key)}`));
        return value;
    }

    public tryGet(key: Data): TV | undefined {
        requiresTruthy('key', key);
        return this._map.get(key);
    }

    public has(key: Data): boolean {
        requiresTruthy('key', key);
        return this._map.has(key);
    }

    public set(key: Data, value: TV) {
        requiresTruthy('key', key);
        this._map.set(key, value);
    }

    public delete(key: Data) {
        requiresTruthy('key', key);
        this._map.delete(key);
    }

    public keys(): IterableIterator<Data> {
        return this._map.keys();
    }

    public values(): IterableIterator<TV> {
        return this._map.values();
    }
}

export class WarpKey implements IKey {
    public readonly value: WarpKeyString;

    constructor(public readonly warpId: Unsigned, public readonly warpVersion: Unsigned) {
        requiresPositiveUnsigned('warpId', warpId);
        requiresPositiveUnsigned('warpVersion', warpVersion);
        this.value = `${WarpKey.name}-${this.warpId.toString()}@${this.warpVersion.toString()}`;
    }

    equals(other: WarpKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return this.getName();
    }

    getName(): string {
        return WarpRegistry.instance.getName(this);
    }
}

export class DataClassKey implements IKey {
    public readonly value: ClassKeyString;

    constructor(public readonly warpKey: WarpKey, public readonly classId: ClassId) {
        requiresTruthy('warpKey', warpKey);
        requiresTruthy('classId', classId);
        this.value = `${DataClassKey.name}-${warpKey.value}-${classId}`;
    }

    equals(other: DataClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.warpKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    getName(): string {
        return DataRegistry.instance.getName(this);
    }
}

export class ServiceClassKey implements IKey {
    public readonly value: ClassKeyString;

    constructor(public readonly warpKey: WarpKey, public readonly classId: ClassId) {
        requiresTruthy('warpKey', warpKey);
        requiresTruthy('classId', classId);
        this.value = `${ServiceClassKey.name}-${warpKey.value}-${classId}`;
    }

    equals(other: ServiceClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.warpKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    getName(): string {
        return ServiceRegistry.instance.getName(this);
    }
}

export class MessageClassKey implements IKey {
    public readonly value: string;

    constructor(public readonly warpKey: WarpKey, public readonly classId: ClassId) {
        requiresTruthy('warpKey', warpKey);
        requiresTruthy('classId', classId);
        this.value = `${MessageClassKey.name}-${warpKey.value}-${classId}`;
    }

    equals(other: MessageClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.warpKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    getName(): string {
        return MessageRegistry.instance.getName(this);
    }
}

export class DataKey implements IKey {
    public readonly value: DataKeyString;

    constructor(public readonly classKey: DataClassKey, public readonly primaryKey: string) {
        requiresTruthy('classKey', classKey);
        requiresTruthy('primaryKey', primaryKey);
        this.value = `${DataKey.name}-${classKey.value}-${primaryKey}`;
    }

    equals(other: DataKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.classKey.getFullyQualifiedName()}#${this.primaryKey}`;
    }

    getName(): string {
        return `${this.classKey.getName()}#${this.primaryKey}`;
    }
}

export class ServiceKey implements IKey {
    public readonly value: ServiceKeyString;

    constructor(public readonly classKey: ServiceClassKey, public readonly primaryKey: string) {
        requiresTruthy('classKey', classKey);
        requiresTruthy('primaryKey', primaryKey);
        this.value = `${ServiceKey.name}-${classKey.value}-${primaryKey}`;
    }

    equals(other: ServiceKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.classKey.getFullyQualifiedName()}#${this.primaryKey}`;
    }

    getName(): string {
        return `${this.classKey.getName()}#${this.primaryKey}`;
    }
}

export type MessageSourceKey = DataKey | ServiceKey;

export class MessageInstanceKey implements IKey {
    public readonly value: string;

    constructor(public readonly messageClassKey: MessageClassKey,
                public readonly sourceKey: MessageSourceKey) {
        requiresTruthy('messageClassKey', messageClassKey);
        requiresTruthy('sourceKey', sourceKey);
        this.value = `${MessageInstanceKey.name}-${messageClassKey.value}-${sourceKey.value}`;
    }

    equals(other: MessageClassKey): boolean {
        if (!other)
            return false;
        return this.value === other.value;
    }

    getFullyQualifiedName(): string {
        return `${this.messageClassKey.getFullyQualifiedName()}/${this.getName()}`;
    }

    getName(): string {
        return `${this.sourceKey.getName()}`
    }

    getSourceWarpReferenceUnionProto(): WarpReferenceUnionProto {
        if (this.sourceKey instanceof DataKey)
            return WarpReferenceUnionProto.DataReferenceValueProto;
        else
            return WarpReferenceUnionProto.ServiceReferenceValueProto;
    }
}

export class WarpRegistration {
    constructor(public readonly name: string,
                public readonly warpKey: WarpKey,
                public readonly userKey: string) {
        requiresTruthy('name', name);
        requiresTruthy('warpKey', warpKey);
        requiresTruthy('userKey', userKey);
    }
}

export class DataClassRegistration {
    constructor(public readonly classKey: DataClassKey,
                public readonly ctor: Function,
                public readonly name: string) {
        if (!ctor || typeof ctor !== 'function')
            throw new Error('invalid ctor');
        requiresTruthy('classKey', classKey);
        requiresTruthy('name', name);
    }
}

export class ServiceClassRegistration {
    constructor(public readonly classKey: ServiceClassKey,
                public readonly ctor: Function,
                public readonly name: string) {
        if (!ctor || typeof ctor !== 'function')
            throw new Error('invalid ctor');
        requiresTruthy('classKey', classKey);
        requiresTruthy('name', name);
    }
}

export class MessageClassRegistration {
    constructor(public readonly classKey: MessageClassKey,
                public readonly ctor: Function,
                public readonly name: string) {
        if (!ctor || typeof ctor !== 'function')
            throw new Error('invalid ctor');
        requiresTruthy('classKey', classKey);
        requiresTruthy('name', name);
    }
}

export type OkResponseType = CallServiceMethodResponseProto |
    GetDataResponseProto |
    SaveDataResponseProto |
    SubscribeMessageResponseProto |
    SubscribeDataUpdatesResponseProto |
    UnsubscribeMessageResponseProto |
    UnsubscribeDataUpdatesResponseProto;


export class PlatformException {
    constructor(public code: Code,
                public codeString: string) {
        requiresTruthy('code', code);
        requiresTruthy('codeString', codeString);
    }
}

export class ScriptException {
    constructor(public readonly stack: string,
                public readonly message: string) {
        requiresTruthy('stack', stack);
        requiresTruthy('message', message);
    }
}

export class UserResponse<T extends OkResponseType> {
    constructor(public readonly platformException: PlatformException | undefined,
                public readonly exception: ScriptException | undefined,
                public readonly response: T | undefined,
                public readonly messages: UserMessageUnionWrapperProto[] | undefined,
                public readonly consoleLog: ConsoleLogProto | undefined) {
    }

    static createOk<T extends OkResponseType>(response: T, messages: UserMessageUnionWrapperProto[] | undefined, consoleLog: ConsoleLogProto | undefined): UserResponse<T> {
        return new UserResponse<T>(undefined, undefined, response, messages, consoleLog);
    }

    static createScriptException<T extends OkResponseType>(exception: ScriptException, consoleLog: ConsoleLogProto | undefined): UserResponse<T> {
        return new UserResponse<T>(undefined, exception, undefined, undefined, consoleLog);
    }

    static createPlatformException<T extends OkResponseType>(platformException: PlatformException, consoleLog: ConsoleLogProto | undefined): UserResponse<T> {
        return new UserResponse<T>(platformException, undefined, undefined, undefined, consoleLog);
    }
}
