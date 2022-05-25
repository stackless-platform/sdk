import {Builder, ByteBuffer, Offset} from "flatbuffers";

import {requiresAtLeastOneElement, requiresPositiveUnsigned, requiresTruthy} from "./requires.js";
import {DataRegistry, ServiceRegistry} from "./registry.js";
import {Unsigned, UnsignedOne, UnsignedZero} from "./unsigned.js";
import {logError, logVerbose, sysLogError} from "./logging.js";
import {getCodeName, Code} from "../code.js";
import {DataProto} from "../protocol/data-proto.js";
import {ErrorCodeResponseProto} from "../protocol/error-code-response-proto.js";
import {NumberValueProto} from "../protocol/number-value-proto.js";
import {UndefinedValueProto} from "../protocol/undefined-value-proto.js";
import {RiverUserResponseProto} from "../protocol/river-user-response-proto.js";
import {StringValueProto} from "../protocol/string-value-proto.js";
import {NestedDataProto} from "../protocol/nested-data-proto.js";
import {BooleanValueProto} from "../protocol/boolean-value-proto.js";
import {ObjectValueProto} from "../protocol/object-value-proto.js";
import {ArrayValueProto} from "../protocol/array-value-proto.js";
import {NullValueProto} from "../protocol/null-value-proto.js";
import {SaveDataRequestProto} from "../protocol/save-data-request-proto.js";
import {CallServiceMethodRequestProto} from "../protocol/call-service-method-request-proto.js";
import {UserRequestProto} from "../protocol/user-request-proto.js";
import {MapValueProto} from "../protocol/map-value-proto.js";
import {UnsubscribeMessageRequestProto} from "../protocol/unsubscribe-message-request-proto.js";
import {UserMessageUnionWrapperProto} from "../protocol/user-message-union-wrapper-proto.js";
import {DataDeltaProto} from "../protocol/data-delta-proto.js";
import {UserRequestUnionProto} from "../protocol/user-request-union-proto.js";
import {ValueProto} from "../protocol/value-proto.js";
import {UnsubscribeDataUpdatesRequestProto} from "../protocol/unsubscribe-data-updates-request-proto.js";
import {UserResponseUnionWrapperProto} from "../protocol/user-response-union-wrapper-proto.js";
import {ExceptionResponseProto} from "../protocol/exception-response-proto.js";
import {UserResponseUnionProto} from "../protocol/user-response-union-proto.js";
import {SetValueProto} from "../protocol/set-value-proto.js";
import {SubscribeMessageRequestProto} from "../protocol/subscribe-message-request-proto.js";
import {InboundDataDeltaProto} from "../protocol/inbound-data-delta-proto.js";
import {NestedPropertyProto} from "../protocol/nested-property-proto.js";
import {SubscribeDataUpdatesRequestProto} from "../protocol/subscribe-data-updates-request-proto.js";
import {MapValueItemProto} from "../protocol/map-value-item-proto.js";
import {DateValueProto} from "../protocol/date-value-proto.js";
import {ValueUnionProto} from "../protocol/value-union-proto.js";
import {ServiceReferenceValueProto} from "../protocol/service-reference-value-proto.js";
import {ArrayItemValueProto} from "../protocol/array-item-value-proto.js";
import {ConsoleLogProto} from "../protocol/console-log-proto.js";
import {PropertyProto} from "../protocol/property-proto.js";
import {GetDataRequestProto} from "../protocol/get-data-request-proto.js";
import {DataReferenceValueProto} from "../protocol/data-reference-value-proto.js";
import {WarpReferenceUnionProto} from "../protocol/warp-reference-union-proto.js";
import {options} from "../options.js";
import {Tracker} from "./tracker.js";
import {Message, Data, Service} from "../../public/model-types.js";
import {
    createDataInstance,
    IKey,
    KeyMap,
    KeySet,
    MethodId,
    OkResponseType,
    PlatformException,
    ScriptException,
    UserResponse,
    MessageInstanceKey,
    WarpKey,
    DataClassKey,
    DataKey,
    ServiceClassKey,
    ServiceKey
} from "../internal-model-types.js";
import {
    ScriptError,
    PlatformError
} from "../../public/error.js";
import {RIVER_PROTOCOL_VERSION} from "../config.js";

interface TypeInfo {
    unwrap: boolean,
    type: ValueUnionProto
}

function getValueType(arg: any): TypeInfo {
    if (arg === null)
        return {unwrap: false, type: ValueUnionProto.NullValueProto};

    const notSupported = (s: string) => {
        return `Cannot pass a ${s} as an argument because the type isn't supported.`
    };
    const type = typeof arg;
    switch (type) {
        case "undefined":
            return {unwrap: false, type: ValueUnionProto.UndefinedValueProto};
        case "boolean":
            return {unwrap: false, type: ValueUnionProto.BooleanValueProto};
        case "number":
            return {unwrap: false, type: ValueUnionProto.NumberValueProto};
        case "string":
            return {unwrap: false, type: ValueUnionProto.StringValueProto};
        case "object": {
            if (arg instanceof Date)
                return {unwrap: false, type: ValueUnionProto.DateValueProto};
            if (arg instanceof Data)
                return {unwrap: false, type: ValueUnionProto.DataReferenceValueProto};
            if (arg instanceof Service)
                return {unwrap: false, type: ValueUnionProto.ServiceReferenceValueProto};
            if (arg instanceof Message)
                throw new Error(notSupported("Message"));
            if (arg instanceof Array)
                return {unwrap: false, type: ValueUnionProto.ArrayValueProto};
            if (arg instanceof Map)
                return {unwrap: false, type: ValueUnionProto.MapValueProto};
            if (arg instanceof Set)
                return {unwrap: false, type: ValueUnionProto.SetValueProto};
            if (arg instanceof String)
                return {unwrap: true, type: ValueUnionProto.StringValueProto};
            if (arg instanceof Number)
                return {unwrap: true, type: ValueUnionProto.NumberValueProto};
            if (arg instanceof Boolean)
                return {unwrap: true, type: ValueUnionProto.BooleanValueProto};
            return {unwrap: false, type: ValueUnionProto.ObjectValueProto};
        }
        default:
            throw new Error(notSupported(type));
    }
}

class DataTransferQueue {
    private _queue: Data[] = [];
    private _warpKey: WarpKey | undefined;
    private _keys = new KeySet<DataKey>();

    /*Pass in a WarpKey to make sure all further objects have the same one.*/
    constructor(warpKey?: WarpKey) {
        this._warpKey = warpKey;
    }

    get warpKey(): WarpKey | undefined {
        return this._warpKey;
    }

    get length() {
        return this._queue.length;
    }

    pop(): Data {
        const item = this._queue.shift();
        if (!item)
            throw new Error('no items found');
        return item;
    }

    tryAdd(data: Data): DataKey | undefined {
        const classKey = DataRegistry.instance.getClassKey(data.constructor);
        const objectKey = new DataKey(classKey, data.primaryKey);
        if (this._keys.add(objectKey)) {
            if (this._warpKey) {
                if (!this._warpKey.equals(classKey.warpKey))
                    throw new Error(`Unable to transfer objects from different warps. ${classKey.warpKey.value} is different than ${this._warpKey.value}`);
            } else {
                this._warpKey = classKey.warpKey;
            }

            this._queue.push(data);
            return objectKey;
        }
        return undefined;
    }
}

function serializeValue(builder: Builder, arg: any, transferQueue: DataTransferQueue): Offset {
    const {unwrap, type} = getValueType(arg);
    switch (type) {
        case ValueUnionProto.UndefinedValueProto: {
            return ValueProto.createValueProto(builder, type, UndefinedValueProto.createUndefinedValueProto(builder));
        }
        case ValueUnionProto.NullValueProto: {
            return ValueProto.createValueProto(builder, type, NullValueProto.createNullValueProto(builder));
        }
        case ValueUnionProto.BooleanValueProto: {
            if (unwrap)
                arg = (<Boolean>arg).valueOf();
            return ValueProto.createValueProto(builder, type, BooleanValueProto.createBooleanValueProto(builder, <boolean>arg));
        }
        case ValueUnionProto.StringValueProto: {
            if (unwrap)
                arg = (<String>arg).valueOf();
            return ValueProto.createValueProto(builder, type, StringValueProto.createStringValueProto(builder, builder.createString(<string>arg)));
        }
        case ValueUnionProto.NumberValueProto: {
            if (unwrap)
                arg = (<Number>arg).valueOf();
            return ValueProto.createValueProto(builder, type, NumberValueProto.createNumberValueProto(builder, <number>arg));
        }
        case ValueUnionProto.ObjectValueProto: {
            const properties = [];
            for (const name of Object.getOwnPropertyNames(arg)) {
                const nameOff = builder.createString(name);
                const argOff = serializeValue(builder, arg[name], transferQueue);
                PropertyProto.startPropertyProto(builder);
                PropertyProto.addName(builder, nameOff);
                PropertyProto.addValue(builder, argOff);
                const prop_off = PropertyProto.endPropertyProto(builder);
                properties.push(prop_off);
            }
            const properties_off = ObjectValueProto.createPropertiesVector(builder, properties);
            return ValueProto.createValueProto(builder, type, ObjectValueProto.createObjectValueProto(builder, properties_off));
        }
        case ValueUnionProto.ArrayValueProto: {
            const items = [];
            let i = 0;
            for (const value of arg) {
                const valueOff = serializeValue(builder, value, transferQueue);
                ArrayItemValueProto.startArrayItemValueProto(builder);
                ArrayItemValueProto.addIndex(builder, i++);
                ArrayItemValueProto.addValue(builder, valueOff);
                items.push(ArrayItemValueProto.endArrayItemValueProto(builder));
            }
            const items_off = ArrayValueProto.createItemsVector(builder, items);
            return ValueProto.createValueProto(builder, type, ArrayValueProto.createArrayValueProto(builder, items_off));
        }
        case ValueUnionProto.DataReferenceValueProto: {
            const data = <Data>arg;
            const classKey = DataRegistry.instance.getClassKey(data.constructor);
            transferQueue.tryAdd(data);
            const primaryKeyOff = builder.createString(data.primaryKey);
            return ValueProto.createValueProto(builder, ValueUnionProto.DataReferenceValueProto,
                DataReferenceValueProto.createDataReferenceValueProto(builder, classKey.classId, primaryKeyOff));
        }
        case ValueUnionProto.ServiceReferenceValueProto: {
            const service = <Service>arg;
            const classKey = ServiceRegistry.instance.getClassKey(service.constructor);
            const primaryKeyOff = builder.createString(service.primaryKey);
            return ValueProto.createValueProto(builder, ValueUnionProto.ServiceReferenceValueProto,
                ServiceReferenceValueProto.createServiceReferenceValueProto(builder, classKey.classId, primaryKeyOff));
        }
        case ValueUnionProto.MapValueProto: {
            const mapArg = <Map<any, any>>arg;
            const items: Offset[] = [];
            for (const [key, value] of mapArg.entries()) {
                const keyOff = serializeValue(builder, key, transferQueue);
                const valueOff = serializeValue(builder, value, transferQueue);
                MapValueItemProto.startMapValueItemProto(builder);
                MapValueItemProto.addKey(builder, keyOff);
                MapValueItemProto.addValue(builder, valueOff);
                items.push(MapValueItemProto.endMapValueItemProto(builder));
            }
            const itemsOff = MapValueProto.createItemsVector(builder, items);
            return ValueProto.createValueProto(builder, ValueUnionProto.MapValueProto, MapValueProto.createMapValueProto(builder, itemsOff));
        }
        case ValueUnionProto.SetValueProto: {
            const setArg = <Set<any>>arg;
            const values: Offset[] = [];
            setArg.forEach((item) => {
                values.push(serializeValue(builder, item, transferQueue));
            })
            const valuesOff = SetValueProto.createItemsVector(builder, values);
            return ValueProto.createValueProto(builder, ValueUnionProto.SetValueProto, SetValueProto.createSetValueProto(builder, valuesOff));
        }
        case ValueUnionProto.DateValueProto: {
            const date = <Date>arg;
            return ValueProto.createValueProto(builder, ValueUnionProto.DateValueProto, DateValueProto.createDateValueProto(builder, date.valueOf()));
        }
        default:
            throw new Error("Unexpected argument type");
    }
}

function createInboundDataDelta(builder: Builder, data: Data, transferQueue: DataTransferQueue): Offset {
    const classKey = DataRegistry.instance.getClassKey(data.constructor);

    // BUG: Deleted Properties won't be sent to the server as deleted properties.
    // https://warpdrive-network.atlassian.net/browse/WARP-66?atlOrigin=eyJpIjoiNWI4ODdmM2Q3NzQyNGU0YWIwYzMxNTBmOGM4NDIwZmEiLCJwIjoiaiJ9

    let objectVersion = DataRegistry.instance.tryGetVersion(data);
    if (!objectVersion) {
        objectVersion = UnsignedZero;
    }

    //note: since the client can't know what properties have changed, I send all of them and let the server figure it out.

    const properties: Offset[] = [];
    const valueBuilder = new Builder();
    for (const name of Object.getOwnPropertyNames(data)) {
        // @ts-ignore
        const value = data[name];
        const nameOff = builder.createString(name);
        valueBuilder.clear();
        valueBuilder.finish(serializeValue(valueBuilder, value, transferQueue));
        const valueBytesOff = NestedPropertyProto.createValueBytesVector(builder, valueBuilder.asUint8Array());
        NestedPropertyProto.startNestedPropertyProto(builder);
        NestedPropertyProto.addName(builder, nameOff);
        NestedPropertyProto.addValueBytes(builder, valueBytesOff);
        properties.push(NestedPropertyProto.endNestedPropertyProto(builder));
    }

    const properties_off = DataProto.createPropertiesVector(builder, properties);

    return InboundDataDeltaProto.createInboundDataDeltaProto(builder, classKey.classId, objectVersion.toLong(),
        builder.createString(data.primaryKey), properties_off, 0);
}

type CreateInnerFunction = (builder: Builder) => Offset;

function createRequest(b: Builder | number, logContext: string, warpId: Unsigned, warpVersion: Unsigned, kind: UserRequestUnionProto, createInner: CreateInnerFunction): Uint8Array {
    requiresTruthy('logContext', logContext);
    requiresPositiveUnsigned('warpId', warpId);
    requiresPositiveUnsigned('warpVersion', warpVersion);

    const builder = typeof b === 'number' ? new Builder(b) : b;

    const req_off = UserRequestProto.createUserRequestProto(
        builder,
        RIVER_PROTOCOL_VERSION,
        builder.createString(logContext),
        warpId.toLong(),
        warpVersion.toLong(),
        kind,
        createInner(builder)
    );
    builder.finish(req_off);
    return builder.asUint8Array();
}

const CALL_SERVICE_METHOD_REQUEST_BUFFER_SIZE = 10 * 1024;
const GET_DATA_REQUEST_BUFFER_SIZE = 100;
const SAVE_DATA_REQUEST_BUFFER_SIZE = 10 * 1024;
const CREATE_SUBSCRIBE_MESSAGE_REQUEST_BUFFER_SIZE = 100;
const CREATE_UNSUBSCRIBE_MESSAGE_REQUEST_BUFFER_SIZE = 100;
const CREATE_SUBSCRIBE_DATA_UPDATES_REQUEST_BUFFER_SIZE = 1024;
const CREATE_UNSUBSCRIBE_DATA_UPDATES_REQUEST_BUFFER_SIZE = 1024;

export function createCallServiceMethodRequest(logContext: string, serviceKey: ServiceKey, methodId: MethodId, args: any[]): Uint8Array {
    requiresTruthy('serviceKey', serviceKey);
    requiresTruthy('methodId', methodId);

    const warpKey = serviceKey.classKey.warpKey;

    return createRequest(CALL_SERVICE_METHOD_REQUEST_BUFFER_SIZE, logContext, warpKey.warpId, warpKey.warpVersion, UserRequestUnionProto.CallServiceMethodRequestProto, (builder) => {
        const transferQueue = new DataTransferQueue(warpKey);

        const argsOffsets: Offset[] = [];
        for (const arg of args) {
            argsOffsets.push(serializeValue(builder, arg, transferQueue));
        }

        const inboundDataDeltaOffsets: Offset[] = [];
        while (transferQueue.length > 0) {
            inboundDataDeltaOffsets.push(createInboundDataDelta(builder, transferQueue.pop(), transferQueue));
        }

        return CallServiceMethodRequestProto.createCallServiceMethodRequestProto(
            builder,
            serviceKey.classKey.classId,
            builder.createString(serviceKey.primaryKey),
            methodId,
            CallServiceMethodRequestProto.createArgumentsVector(builder, argsOffsets),
            CallServiceMethodRequestProto.createReferencedDataDeltasVector(builder, inboundDataDeltaOffsets)
        );
    });
}

export function createGetDataRequest(logContext: string, dataKey: DataKey): Uint8Array {
    requiresTruthy('dataKey', dataKey);
    const warp_key = dataKey.classKey.warpKey;
    return createRequest(GET_DATA_REQUEST_BUFFER_SIZE, logContext, warp_key.warpId, warp_key.warpVersion, UserRequestUnionProto.GetDataRequestProto, builder => {
        return GetDataRequestProto.createGetDataRequestProto(builder, dataKey.classKey.classId,
            builder.createString(dataKey.primaryKey));
    });
}

export function createSaveDataRequest(logContext: string, data: Data[]): Uint8Array {
    if (typeof data !== 'object' || data.length === 0)
        throw new Error('invalid argument data');

    const transferQueue = new DataTransferQueue();

    for (const d of data) {
        transferQueue.tryAdd(d);
    }

    const builder = new Builder(SAVE_DATA_REQUEST_BUFFER_SIZE);

    const inboundDataDeltaOffsets: Offset[] = [];
    do {
        inboundDataDeltaOffsets.push(createInboundDataDelta(builder, transferQueue.pop(), transferQueue));
    } while (transferQueue.length > 0);

    const warpKey = transferQueue.warpKey;
    if (!warpKey)
        throw new Error("Unexpectedly had no warp key");

    return createRequest(builder, logContext, warpKey.warpId, warpKey.warpVersion, UserRequestUnionProto.SaveDataRequestProto, builder => {
        return SaveDataRequestProto.createSaveDataRequestProto(builder, SaveDataRequestProto.createDataDeltasVector(builder, inboundDataDeltaOffsets));
    });
}

export function createSubscribeMessageRequest(logContext: string, eventInstanceKey: MessageInstanceKey): Uint8Array {
    requiresTruthy('eventInstanceKey', eventInstanceKey);
    const warpKey = eventInstanceKey.messageClassKey.warpKey;
    return createRequest(CREATE_SUBSCRIBE_MESSAGE_REQUEST_BUFFER_SIZE, logContext, warpKey.warpId, warpKey.warpVersion,
        UserRequestUnionProto.SubscribeMessageRequestProto, builder => {
            const warpRefUnionType = eventInstanceKey.getSourceWarpReferenceUnionProto();
            if (warpRefUnionType == WarpReferenceUnionProto.DataReferenceValueProto) {
                return SubscribeMessageRequestProto.createSubscribeMessageRequestProto(
                    builder,
                    eventInstanceKey.messageClassKey.classId,
                    warpRefUnionType,
                    DataReferenceValueProto.createDataReferenceValueProto(
                        builder, eventInstanceKey.sourceKey.classKey.classId, builder.createString(eventInstanceKey.sourceKey.primaryKey)
                    ));
            } else {
                return SubscribeMessageRequestProto.createSubscribeMessageRequestProto(
                    builder,
                    eventInstanceKey.messageClassKey.classId,
                    warpRefUnionType,
                    ServiceReferenceValueProto.createServiceReferenceValueProto(
                        builder, eventInstanceKey.sourceKey.classKey.classId, builder.createString(eventInstanceKey.sourceKey.primaryKey)
                    ));
            }
        });
}

export function createUnsubscribeMessageRequest(logContext: string, eventInstanceKey: MessageInstanceKey): Uint8Array {
    requiresTruthy('eventInstanceKey', eventInstanceKey);
    const warpKey = eventInstanceKey.messageClassKey.warpKey;
    return createRequest(CREATE_UNSUBSCRIBE_MESSAGE_REQUEST_BUFFER_SIZE, logContext, warpKey.warpId, warpKey.warpVersion,
        UserRequestUnionProto.UnsubscribeMessageRequestProto, builder => {
            const warpRefUnionType = eventInstanceKey.getSourceWarpReferenceUnionProto();
            if (warpRefUnionType == WarpReferenceUnionProto.DataReferenceValueProto) {
                return UnsubscribeMessageRequestProto.createUnsubscribeMessageRequestProto(
                    builder,
                    eventInstanceKey.messageClassKey.classId,
                    warpRefUnionType,
                    DataReferenceValueProto.createDataReferenceValueProto(
                        builder, eventInstanceKey.sourceKey.classKey.classId, builder.createString(eventInstanceKey.sourceKey.primaryKey)
                    ));
            } else {
                return UnsubscribeMessageRequestProto.createUnsubscribeMessageRequestProto(
                    builder,
                    eventInstanceKey.messageClassKey.classId,
                    warpRefUnionType,
                    ServiceReferenceValueProto.createServiceReferenceValueProto(
                        builder, eventInstanceKey.sourceKey.classKey.classId, builder.createString(eventInstanceKey.sourceKey.primaryKey)
                    ));
            }
        })
}

export function createSubscribeDataUpdatesRequest(logContext: string, objectKeys: DataKey[]): Uint8Array {
    requiresTruthy('objectKeys', objectKeys);
    requiresAtLeastOneElement('objectKeys', objectKeys);

    const builder = new Builder(CREATE_SUBSCRIBE_DATA_UPDATES_REQUEST_BUFFER_SIZE);
    const referencesOffsets: Offset[] = [];

    let warpKey: WarpKey | null = null;
    for (const objectKey of objectKeys) {
        if (!warpKey) {
            warpKey = objectKey.classKey.warpKey;
        } else {
            if (!objectKey.classKey.warpKey.equals(warpKey))
                throw new Error('Not all objects are from the same warp');
        }
        referencesOffsets.push(DataReferenceValueProto.createDataReferenceValueProto(builder,
            objectKey.classKey.classId, builder.createString(objectKey.primaryKey)));
    }

    if (!warpKey)
        throw new Error('Unexpectedly warpKey was falsey');

    const referencesVec = SubscribeDataUpdatesRequestProto.createReferencesVector(builder, referencesOffsets);

    return createRequest(builder, logContext, warpKey.warpId, warpKey.warpVersion,
        UserRequestUnionProto.SubscribeDataUpdatesRequestProto, builder => {
            return SubscribeDataUpdatesRequestProto.createSubscribeDataUpdatesRequestProto(
                builder,
                referencesVec
            );
        });
}

export function createUnsubscribeDataUpdatesRequest(logContext: string, objectKeys: DataKey[]): Uint8Array {
    requiresTruthy('objectKeys', objectKeys);
    requiresAtLeastOneElement('objectKeys', objectKeys);

    const builder = new Builder(CREATE_UNSUBSCRIBE_DATA_UPDATES_REQUEST_BUFFER_SIZE);
    const referencesOffsets: Offset[] = [];

    let warpKey: WarpKey | null = null;
    for (const objectKey of objectKeys) {
        if (!warpKey) {
            warpKey = objectKey.classKey.warpKey;
        } else {
            if (!objectKey.classKey.warpKey.equals(warpKey))
                throw new Error('Not all objects are from the same warp');
        }
        referencesOffsets.push(DataReferenceValueProto.createDataReferenceValueProto(builder,
            objectKey.classKey.classId, builder.createString(objectKey.primaryKey)));
    }

    if (!warpKey)
        throw new Error('Unexpectedly warpKey was falsey');

    const referencesVec = UnsubscribeDataUpdatesRequestProto.createReferencesVector(builder, referencesOffsets);

    return createRequest(builder, logContext, warpKey.warpId, warpKey.warpVersion,
        UserRequestUnionProto.UnsubscribeDataUpdatesRequestProto, builder => {
            return UnsubscribeDataUpdatesRequestProto.createUnsubscribeDataUpdatesRequestProto(
                builder,
                referencesVec
            );
        });
}

function assertResponseType(expected: UserResponseUnionProto, actual: UserResponseUnionProto) {
    if (expected !== actual)
        throw new Error(sysLogError(`Received response type ${expected} when ${actual} expected.`));
}

export function readResponse<T extends OkResponseType>(logContext: string,
                                                       buffer: ArrayBuffer,
                                                       expectedType: UserResponseUnionProto,
                                                       c: new() => T,
                                                       acceptMessages: boolean): UserResponse<T> {
    requiresTruthy('buffer', buffer);
    requiresTruthy('expectedType', expectedType);

    const outerByteBuffer = new ByteBuffer(new Uint8Array(buffer));
    const riverUserResponseProto = RiverUserResponseProto.getRootAsRiverUserResponseProto(outerByteBuffer);

    // Get the console log
    let consoleLog;
    {
        const consoleLogBytesProto = riverUserResponseProto.consoleLog();
        if (consoleLogBytesProto) {
            const bytes = consoleLogBytesProto.bytesArray();
            if (bytes) {
                consoleLog = ConsoleLogProto.getRootAsConsoleLogProto(new ByteBuffer(bytes));
            } else {
                logError(logContext, "Unable to read console log output because the data returned was empty.")
            }
        }
    }

    // Get the user response
    let userResponseProto;
    {
        const userResponseWrapperBytesProto = riverUserResponseProto.response();
        if (!userResponseWrapperBytesProto)
            throw new Error('Response from River contained no data');
        const bytes = userResponseWrapperBytesProto.bytesArray();
        if (!bytes)
            throw new Error('Response from River contained an empty bytes array');
        userResponseProto = UserResponseUnionWrapperProto.getRootAsUserResponseUnionWrapperProto(new ByteBuffer(bytes));
    }

    const userResponseTypeProto = userResponseProto.valueType();
    switch (userResponseTypeProto) {
        case UserResponseUnionProto.NONE: {
            throw new Error(logError(logContext, 'Response contained invalid data because the response type was NONE'));
        }
        case UserResponseUnionProto.ErrorCodeResponseProto: {
            const responseProto = userResponseProto.value(new ErrorCodeResponseProto());
            if (!responseProto)
                throw new Error(logError(logContext, 'ErrorCode response was invalid because it was empty'));
            const code = <Code>responseProto.errorCode();
            return UserResponse.createPlatformException<T>(new PlatformException(code, getCodeName(code)), consoleLog);
        }
        case UserResponseUnionProto.ExceptionResponseProto: {
            const responseProto = userResponseProto.value(new ExceptionResponseProto());
            if (!responseProto)
                throw new Error(logError(logContext, 'Exception response was invalid because it was empty'));
            return UserResponse.createScriptException<T>(new ScriptException(
                responseProto.stack() ? <string>responseProto.stack() : "<empty>",
                responseProto.message() ? <string>responseProto.message() : "<empty>"), consoleLog);
        }
        default: {
            assertResponseType(expectedType, userResponseTypeProto);
            const responseProto = userResponseProto.value(new c());
            if (!responseProto)
                throw new Error(logError(logContext, 'Response contained invalid data because it was empty'));

            if (!acceptMessages) {
                if (riverUserResponseProto.messagesLength())
                    throw new Error(logError(logContext, 'Unexpectedly received messages in response'));
                return UserResponse.createOk<T>(responseProto, undefined, consoleLog);
            } else if (riverUserResponseProto.messagesLength()) {
                const messages: UserMessageUnionWrapperProto[] = [];
                for (let i = 0; i < riverUserResponseProto.messagesLength(); ++i) {
                    const messageWrapperBytes = riverUserResponseProto.messages(i);
                    if (!messageWrapperBytes)
                        throw new Error(logError(logContext, 'Response contained invalid message data bytes'));
                    const bytes = messageWrapperBytes.bytesArray();
                    if (!bytes)
                        throw new Error(logError(logContext, 'Response contained and invalid message data bytes array'));
                    const messageWrapper = UserMessageUnionWrapperProto.getRootAsUserMessageUnionWrapperProto(new ByteBuffer(bytes));
                    if (!messageWrapper)
                        throw new Error(logError(logContext, 'Response contained invalid message data'));
                    messages.push(messageWrapper);
                }
                return UserResponse.createOk<T>(responseProto, messages, consoleLog);
            }

            return UserResponse.createOk<T>(responseProto, undefined, consoleLog);
        }
    }
}

function unwrap<T>(logContext: string, value: ValueProto, c: new() => T): T {
    const v = value.value(new c());
    if (!v)
        throw new Error(logError(logContext, `Unable to deserialize value because it contained invalid data`));
    return v;
}

export function isDataReferenceType(o: any) {
    return o === ValueUnionProto.DataReferenceValueProto;
}

export function isServiceReferenceType(o: any) {
    return o === ValueUnionProto.ServiceReferenceValueProto;
}

export function readProperty(logContext: string, key: IKey, propertyProto: PropertyProto | NestedPropertyProto | null): { name: string, valueProto: ValueProto } {
    if (!propertyProto)
        throw new Error(logError(logContext, `Unable to read property of ${key.getFullyQualifiedName()} because it contained invalid data`));

    const name = propertyProto.name();
    if (!name)
        throw new Error(logError(logContext, `Unable to read property of ${key.getFullyQualifiedName()} because its name was empty`));

    let valueProto;
    if (propertyProto instanceof PropertyProto) {
        valueProto = propertyProto.value();
    } else /*NestedPropertyProto*/ {
        const valueBytes = propertyProto.valueBytesArray();
        if (!valueBytes)
            throw new Error(logError(logContext, `Unable to read property of ${key.getFullyQualifiedName()} because its value contained invalid data`));
        const valueBuffer = new ByteBuffer(valueBytes);
        valueProto = ValueProto.getRootAsValueProto(valueBuffer);
    }

    if (!valueProto)
        throw new Error(logError(logContext, `Unable to read property of ${key.getFullyQualifiedName()} because its value proto contained invalid data`));

    return {name, valueProto};
}

export function deserializeValue(logContext: string, warpKey: WarpKey, value: ValueProto, tracker: Tracker): { type: ValueUnionProto, value: any } {
    requiresTruthy('logContext', logContext);
    requiresTruthy('warpKey', warpKey);
    requiresTruthy('value', value);
    requiresTruthy('tracker', tracker);

    const type = value.valueType();
    switch (type) {
        case ValueUnionProto.UndefinedValueProto:
            return {type, value: undefined};
        case ValueUnionProto.NullValueProto:
            return {type, value: null};
        case ValueUnionProto.BooleanValueProto:
            return {type, value: unwrap<BooleanValueProto>(logContext, value, BooleanValueProto).value()};
        case ValueUnionProto.StringValueProto:
            return {type, value: unwrap<StringValueProto>(logContext, value, StringValueProto).value()};
        case ValueUnionProto.NumberValueProto:
            return {type, value: unwrap<NumberValueProto>(logContext, value, NumberValueProto).value()};
        case ValueUnionProto.ObjectValueProto: {
            const objectValueProto = unwrap<ObjectValueProto>(logContext, value, ObjectValueProto);
            const object = {};
            for (let i = 0; i < objectValueProto.propertiesLength(); ++i) {
                const properties = objectValueProto.properties(i);
                if (!properties)
                    throw new Error(logError(logContext, "Unable to deserialize object property because it was null"));

                const name = properties.name();
                if (!name)
                    throw new Error(logError(logContext, `Unable to deserialize object property name because it was null`));

                const valueProto = properties.value();
                if (!valueProto)
                    throw new Error(logError(logContext, 'Unable to deserialize object property value because it was null'));

                const {
                    type: valueType,
                    value
                } = deserializeValue(logContext, warpKey, valueProto, tracker);

                if (valueType == ValueUnionProto.DataReferenceValueProto) {
                    tracker.dataResolutionQueue.enqueue(<DataKey>value, data => {
                        Object.defineProperty(object, name, {
                            value: data,
                            configurable: false,
                            enumerable: true,
                            writable: true
                        });
                    });
                } else {
                    Object.defineProperty(object, name, {
                        value: value,
                        configurable: false,
                        enumerable: true,
                        writable: true
                    });
                }
            }
            return {type, value: object};
        }
        case ValueUnionProto.ArrayValueProto: {
            const arrayValueProto = unwrap<ArrayValueProto>(logContext, value, ArrayValueProto);
            const array = [];
            for (let i = 0; i < arrayValueProto.itemsLength(); ++i) {
                const itemProto = arrayValueProto.items(i, new ArrayItemValueProto());
                if (!itemProto)
                    throw new Error(logError(logContext, 'Unable to deserialize array item because it was null'));

                const valueProto = itemProto.value(new ValueProto());
                if (!valueProto)
                    throw new Error(logError(logContext, 'Unable to deserialize array item value because it was null'));

                const {
                    type: valueType,
                    value
                } = deserializeValue(logContext, warpKey, valueProto, tracker);

                const index = itemProto.index();

                if (valueType == ValueUnionProto.DataReferenceValueProto) {
                    tracker.dataResolutionQueue.enqueue(<DataKey>value, data => {
                        array[index] = data;
                    });
                } else {
                    array[index] = value;
                }
            }
            return {type, value: array};
        }
        case ValueUnionProto.DataReferenceValueProto: {
            const objectReferenceValueProto = unwrap<DataReferenceValueProto>(logContext, value, DataReferenceValueProto);
            const primaryKey = objectReferenceValueProto.primaryKey();
            if (!primaryKey)
                throw new Error(logError(logContext, 'Unable to deserialize warp object reference because it contained an invalid primary key'));
            return {
                type,
                value: new DataKey(new DataClassKey(warpKey, objectReferenceValueProto.classId()), primaryKey)
            };
        }
        case ValueUnionProto.ServiceReferenceValueProto: {
            const serviceReferenceValueProto = unwrap<ServiceReferenceValueProto>(logContext, value, ServiceReferenceValueProto);
            const primaryKey = serviceReferenceValueProto.primaryKey();
            if (!primaryKey)
                throw new Error(logError(logContext, 'Unable to deserialize warp service reference because it contained an invalid primary key'));
            const serviceKey = new ServiceKey(new ServiceClassKey(warpKey, serviceReferenceValueProto.classId()), primaryKey);
            return {
                type,
                value: ServiceRegistry.instance.createInstance(serviceKey)
            };
        }
        case ValueUnionProto.MapValueProto: {
            const mapValueProto = unwrap<MapValueProto>(logContext, value, MapValueProto);
            const map = new Map<any, any>();
            for (let i = 0; i < mapValueProto.itemsLength(); ++i) {
                const mapValueItemProto = mapValueProto.items(i, new MapValueItemProto());
                if (!mapValueItemProto)
                    throw new Error(logError(logContext, 'Unable to deserialize map item because it was null'));

                const keyValueProto = mapValueItemProto.key(new ValueProto());
                if (!keyValueProto)
                    throw new Error(logError(logContext, 'Unable to deserialize map key because it was null'));

                const valueValueProto = mapValueItemProto.value(new ValueProto());
                if (!valueValueProto)
                    throw new Error(logError(logContext, 'Unable to deserialize map value because it was null'));

                const {
                    type: keyType,
                    value: keyValue
                } = deserializeValue(logContext, warpKey, keyValueProto, tracker);

                const {
                    type: valueType,
                    value: valueValue
                } = deserializeValue(logContext, warpKey, valueValueProto, tracker);

                const keyNeedsResolve = keyType == ValueUnionProto.DataReferenceValueProto;
                const valueNeedsResolve = valueType == ValueUnionProto.DataReferenceValueProto;

                if (keyNeedsResolve && valueNeedsResolve) {
                    tracker.dataResolutionQueue.enqueueMultiple([<DataKey>keyValue, <DataKey>valueValue], dataMap => {
                        const ko = dataMap.get(<DataKey>keyValue);
                        const vo = dataMap.get(<DataKey>valueValue);
                        map.set(ko, vo);
                    });
                } else if (keyNeedsResolve) {
                    tracker.dataResolutionQueue.enqueue(<DataKey>keyValue, data => {
                        map.set(data, valueValue);
                    });
                } else if (valueNeedsResolve) {
                    tracker.dataResolutionQueue.enqueue(<DataKey>valueValue, data => {
                       map.set(keyValue, data);
                    });
                } else {
                    map.set(keyValue, valueValue);
                }
            }
            return {type, value: map};
        }
        case ValueUnionProto.SetValueProto: {
            const setValueProto = unwrap<SetValueProto>(logContext, value, SetValueProto);
            const set = new Set<any>();
            for (let i = 0; i < setValueProto.itemsLength(); ++i) {
                const itemValueProto = setValueProto.items(i, new ValueProto());
                if (!itemValueProto)
                    throw new Error(logError(logContext, 'Unable to deserialize set item because it was null'));

                const {
                    type: itemType,
                    value: itemValue
                } = deserializeValue(logContext, warpKey, itemValueProto, tracker);

                if (itemType == ValueUnionProto.DataReferenceValueProto) {
                    tracker.dataResolutionQueue.enqueue(<DataKey>itemValue, data => {
                        set.add(data);
                    });
                } else {
                    set.add(itemValue);
                }
            }
            return {type, value: set};
        }
        case ValueUnionProto.DateValueProto: {
            const dateValueProto = unwrap<DateValueProto>(logContext, value, DateValueProto);
            return {type, value: new Date(dateValueProto.value())};
        }
        default:
            throw new Error(logError(logContext, `Invalid type ${type} found while deserializing value`));
    }
}

function mergeDeltaProperties(logContext: string, target: object, warpKey: WarpKey, objectKey: DataKey, deltaProto: DataDeltaProto, tracker: Tracker) {
    requiresTruthy('logContext', logContext);
    requiresTruthy('target', target);
    requiresTruthy('warpKey', warpKey);
    requiresTruthy('objectKey', objectKey);
    requiresTruthy('deltaProto', deltaProto);
    requiresTruthy('tracker', tracker);

    //update properties that have been updated
    for (let i = 0; i < deltaProto.propertiesLength(); ++i) {
        const {name, valueProto} = readProperty(logContext, objectKey, deltaProto.properties(i));
        const {type, value} = deserializeValue(logContext, warpKey, valueProto, tracker);
        if(type == ValueUnionProto.DataReferenceValueProto) {
            tracker.dataResolutionQueue.enqueue(<DataKey> value, maybeData => {
                // @ts-ignore
                target[name] = maybeData;
            });
        } else {
            // @ts-ignore
            target[name] = value;
        }
    }

    //delete properties that have been deleted
    for (let i = 0; i < deltaProto.deletedPropertiesLength(); ++i) {
        const name = deltaProto.deletedProperties(i);
        // @ts-ignore
        delete target[name];
    }
}

export function mergeDelta(logContext: string, warpKey: WarpKey, deltaProto: DataDeltaProto, tracker: Tracker): void {
    requiresTruthy('logContext', logContext);
    requiresTruthy('warpKey', warpKey);
    requiresTruthy('deltaProto', deltaProto);
    requiresTruthy('tracker', tracker);

    const objectKey = createDataKeyFromDelta(warpKey, deltaProto);

    const deltaObjectVersion = Unsigned.fromLong(deltaProto.objectVersion());
    if (!deltaObjectVersion || deltaObjectVersion.equals(UnsignedZero))
        throw new Error(logError(logContext, 'Unable to merge warp object because the object version was zero or invalid'));

    let existingObject = DataRegistry.instance.tryGetInstance(objectKey);
    let existingObjectVersion: Unsigned | undefined;
    if (existingObject)
        existingObjectVersion = DataRegistry.instance.tryGetVersion(existingObject);

    if (deltaProto.deleted()) {
        // Deleted
        logVerbose(logContext, `Adding ${objectKey.getFullyQualifiedName()} to object updated firing queue and delete queue`);
        if (existingObject) {
            tracker.dataUpdatedFiringQueue.enqueue(existingObject, true);
        }
        tracker.dataDeleteQueue.enqueue(objectKey);
        logVerbose(logContext, `Delta applied: Object ${objectKey.getFullyQualifiedName()} deleted.`);
    } else if (!existingObjectVersion && deltaObjectVersion.equals(UnsignedOne)) {
        // New version (may have an existing object if they've created it locally)
        let object = existingObject;
        if (!object) {
            object = createDataInstance(objectKey);
            DataRegistry.instance.setInstance(objectKey, object);
        }
        mergeDeltaProperties(logContext, object, warpKey, objectKey, deltaProto, tracker);
        DataRegistry.instance.setVersion(object, UnsignedOne);
        tracker.dataUpdatedFiringQueue.enqueue(object, false);
        if (existingObject)
            logVerbose(logContext, `Delta applied: Locally created object ${objectKey.getFullyQualifiedName()} updated to verson 1.`);
        else
            logVerbose(logContext, `Delta applied: Object ${objectKey.getFullyQualifiedName()} created.`);
    } else if (existingObjectVersion && deltaObjectVersion.value === (existingObjectVersion.value + BigInt(1))) {
        // Updated
        if (!existingObject)
            throw new Error("Unexpectedly the existing object was empty when the existing object version was found.");
        mergeDeltaProperties(logContext, existingObject, warpKey, objectKey, deltaProto, tracker);
        DataRegistry.instance.setVersion(existingObject, deltaObjectVersion);
        tracker.dataUpdatedFiringQueue.enqueue(existingObject, false);
        logVerbose(logContext, `Delta applied: Object ${objectKey.getFullyQualifiedName()} updated to verson ${deltaObjectVersion.toString()}.`);
    } else {
        //Since the delta was rejected, remove the object if one exists and enqueue a getData to replace it.
        DataRegistry.instance.remove(objectKey);
        tracker.dataResolutionQueue.enqueue(objectKey, null);

        if (options.getWarpOptions().enableVerboseLogging) {
            logVerbose(logContext, `Delta rejected. Information used for determination: ${JSON.stringify({
                objectKey: objectKey.getFullyQualifiedName(),
                existingObject: existingObject ? JSON.stringify(existingObject) : "<none>",
                existingObjectVersion: existingObjectVersion ? existingObjectVersion.toString() : "<none>",
                deltaVersion: deltaObjectVersion.toString(),
                deltaDeleted: deltaProto.deleted()
            })}`);
        }
    }
}

export function replaceData(logContext: string, warpKey: WarpKey, objectProto: DataProto | NestedDataProto, tracker: Tracker): Data | null {
    requiresTruthy('logContext', logContext);
    requiresTruthy('warpKey', warpKey);
    requiresTruthy('objectProto', objectProto);
    requiresTruthy('tracker', tracker);

    const classKey = new DataClassKey(warpKey, objectProto.classId());

    const objectVersion = Unsigned.fromLong(objectProto.objectVersion());
    if (objectVersion.equals(UnsignedZero))
        throw new Error(logError(logContext, 'Unable to load warp object because the object version was zero or invalid'));

    const primaryKey = objectProto.primaryKey();
    if (!primaryKey)
        throw new Error(logError(logContext, 'Unable to load warp object because the primary key was invalid'));
    const objectKey = new DataKey(classKey, primaryKey);

    let reused = false;
    let object = DataRegistry.instance.tryGetInstance(objectKey);
    if (object) {
        if (objectProto.deleted()) {
            tracker.dataUpdatedFiringQueue.enqueue(object, true);
            tracker.dataDeleteQueue.enqueue(objectKey);
            return null;
        }
        reused = true;
        for (const name of Object.getOwnPropertyNames(object)) {
            // @ts-ignore
            delete object[name];
        }
    } else {
        object = createDataInstance(objectKey);
        DataRegistry.instance.setInstance(objectKey, object);
    }

    for (let i = 0; i < objectProto.propertiesLength(); ++i) {
        const {name, valueProto} = readProperty(logContext, objectKey, objectProto.properties(i));
        const {type, value} = deserializeValue(logContext, warpKey, valueProto, tracker);
        if(type == ValueUnionProto.DataReferenceValueProto) {
            tracker.dataResolutionQueue.enqueue(<DataKey>value, maybeData => {
                Object.defineProperty(object, name, {
                    value: maybeData,
                    configurable: true,
                    enumerable: true,
                    writable: true
                });
            });
        } else {
            Object.defineProperty(object, name, {
                value: value,
                configurable: true,
                enumerable: true,
                writable: true
            });
        }
    }

    DataRegistry.instance.setVersion(object, objectVersion);

    logVerbose(logContext, `Object ${objectKey.getFullyQualifiedName()} replaced with version ${objectVersion.toString()}`);

    if (reused) {
        tracker.dataUpdatedFiringQueue.enqueue(object, false);
    }

    return object;
}

export interface IUnwrappable<T> {
    __init(i: number, bb: ByteBuffer): T;
}

export function unwrapBytes<T extends IUnwrappable<T>>(logContext: string, bytes: Uint8Array | null, c: new() => T) {
    if (!bytes)
        throw new Error(logError(logContext, "Unable to unwrap because the byte array was empty"));
    const bb = new ByteBuffer(bytes);
    return new c().__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

export function normalizeArrayArg<T>(arg: T | T[]): T[] {
    if (arg instanceof Array) {
        return arg;
    } else {
        return [arg];
    }
}

export function getDataAndKeyMap(data: Data | Data[]):
    { warpKey: WarpKey, objects: Data[], objectKeyMap: KeyMap<DataKey, Data> } {
    requiresTruthy('data', data);

    let objects = normalizeArrayArg(data);

    let warpKey;
    const objectKeyMap = new KeyMap<DataKey, Data>();
    for (const object of objects) {
        const classKey = DataRegistry.instance.getClassKey(object.constructor);
        const objectKey = new DataKey(classKey, object.primaryKey);

        if (!warpKey) {
            warpKey = classKey.warpKey;
        } else {
            if (!warpKey.equals(classKey.warpKey))
                throw new Error(sysLogError(`Data ${objectKey.getFullyQualifiedName()} doesn't belong to the same warp (${warpKey.getFullyQualifiedName()}) as the others. All objects must be from the same warp.`));
        }

        if (objectKeyMap.has(objectKey))
            throw new Error(sysLogError(`Duplicate object ${objectKey.getFullyQualifiedName()}`));

        objectKeyMap.set(objectKey, object);
    }

    if (!warpKey)
        throw new Error(sysLogError('Unexpectedly warpKey was falsey'));

    return {warpKey: warpKey, objects: objects, objectKeyMap: objectKeyMap};
}

export function getDataAndKeys(data: Data | Data[]): { warpKey: WarpKey, objects: Data[], dataKeys: DataKey[] } {
    requiresTruthy('data', data);

    let objects = normalizeArrayArg(data);

    let warpKey;
    let objectKeys: DataKey[] = [];
    let objectKeysSet = new Set<string>();

    for (const object of objects) {
        const classKey = DataRegistry.instance.getClassKey(object.constructor);
        const objectKey = new DataKey(classKey, object.primaryKey);

        if (!warpKey) {
            warpKey = classKey.warpKey;
        } else {
            if (!warpKey.equals(classKey.warpKey))
                throw new Error(sysLogError(`Data ${objectKey.getFullyQualifiedName()} doesn't belong to the same warp (${warpKey.getFullyQualifiedName()}) as the others. All objects must be from the same warp.`));
        }

        if (objectKeysSet.has(objectKey.value))
            throw new Error(sysLogError(`Duplicate object ${objectKey.getFullyQualifiedName()}`));

        objectKeysSet.add(objectKey.value);
        objectKeys.push(objectKey);
    }

    if (!warpKey)
        throw new Error(sysLogError('Unexpectedly warpKey was falsey'));

    return {warpKey: warpKey, objects: objects, dataKeys: objectKeys};
}

export function wrapScriptException(exception: ScriptException) {
    return new ScriptError(exception.message, exception.stack);
}

export function getErrorForNotOkResponse<T extends OkResponseType>(logContext: string, response: UserResponse<T>) {
    if (response.platformException) {
        return new PlatformError(logError(logContext, `The Stackless platform encountered an error ${response.platformException.codeString}`), response.platformException.codeString);
    } else if (response.exception) {
        return wrapScriptException(response.exception);
    } else {
        return new Error(logError(logContext, 'Unexpected non-error and non-OK response'));
    }
}

export function friendlyArgumentRequired(name: string, arg: any) {
    if (!arg)
        throw new Error(`The argument ${name} is required but was either empty or not specified.`);
}

export function friendlyArrayArgumentRequired(name: string, arg: any) {
    if (!arg || !(arg instanceof Array) || arg.length === 0)
        throw new Error(`The argument ${name} is required but was either empty or not specified.`);
}

export function createDataKeyFromDelta(warpKey: WarpKey, delta: DataDeltaProto): DataKey {
    requiresTruthy('warpKey', warpKey);
    requiresTruthy('delta', delta);
    const primaryKey = delta.primaryKey();
    if (!primaryKey) {
        throw new Error(`Unable to create DataKey from delta because the primaryKey was empty`);
    }
    return new DataKey(new DataClassKey(warpKey, delta.classId()), primaryKey);
}