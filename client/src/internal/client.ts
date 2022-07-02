import {Unsigned} from "./util/unsigned.js";
import {MessageRegistry, DataRegistry, WarpRegistry, ServiceRegistry} from "./util/registry.js";
import {requiresTruthy} from "./util/requires.js";
import {getRiverClientAsync} from "./service/river-client-factory.js";
import {createLogContext, logError, logWarn} from "./util/logging.js";
import {options} from "./options.js";
import {deserializeValue, getErrorForNotOkResponse, replaceData} from "./util/serde.js";
import {MessageMessageProto} from "./protocol/message-message-proto.js";
import {DataUpdateMessageProto} from "./protocol/data-update-message-proto.js";
import {UserMessageUnionProto} from "./protocol/user-message-union-proto.js";
import {handleMessageMessageWithTrackerAsync, handleDataUpdateMessage} from "./util/update-handler.js";
import {Tracker} from "./util/tracker.js";
import {ValueProto} from "./protocol/value-proto.js";
import {NestedDataProto} from "./protocol/nested-data-proto.js";
import {
    ClassId,
    MethodId,
    MessageClassKey,
    MessageClassRegistration,
    WarpKey,
    DataClassKey,
    DataClassRegistration,
    DataKey,
    WarpRegistration,
    ServiceClassKey,
    ServiceClassRegistration,
    ServiceKey
} from "./internal-model-types.js";
import {Message, Data, Service, ServiceConstructor} from "../public/model-types.js";
import {ValueUnionProto} from "./protocol/value-union-proto.js";

class Client {
    registerWarp(name: string, userKey: string, warpidString: string, warpVersionString: string): WarpKey {
        //registers a warp with the WarpRegistry
        const warpKey = new WarpKey(new Unsigned(warpidString), new Unsigned(warpVersionString));
        WarpRegistry.instance.register(new WarpRegistration(name, warpKey, userKey));
        return warpKey;
    }

    registerService<T extends Service>(name: string, ctor: ServiceConstructor<T>, warpKey: WarpKey, classId: ClassId) {
        //registers the warp service with the ServiceRegistry
        ServiceRegistry.instance.register(new ServiceClassRegistration(new ServiceClassKey(warpKey, classId), ctor, name));
    }

    registerData<T extends Data>(name: string, ctor: Function, warpKey: WarpKey, classId: ClassId) {
        DataRegistry.instance.register(new DataClassRegistration(new DataClassKey(warpKey, classId), ctor, name));
    }

    registerMessage<T extends Message>(name: string, ctor: Function, warpKey: WarpKey, classId: ClassId) {
        //registers the warp event with the MessageRegistry
        MessageRegistry.instance.register(new MessageClassRegistration(new MessageClassKey(warpKey, classId), ctor, name))
    }

    async callServiceMethodAsync<T extends Service>(service: T, methodId: MethodId, ...args: any): Promise<any> {
        requiresTruthy('service', service);
        requiresTruthy('methodId', methodId);

        const classKey = ServiceRegistry.instance.getClassKey(<ServiceConstructor<T>>service.constructor);
        const serviceKey = new ServiceKey(classKey, service.primaryKey);
        const riverClient = await getRiverClientAsync(classKey.warpKey);
        const logContext = createLogContext();
        const response = await riverClient.callServiceMethodAsync(logContext, serviceKey, methodId, args);

        if (response.consoleLog) {
            for (let i = 0; i < response.consoleLog.messagesLength(); ++i) {
                const logEntry = response.consoleLog.messages(i);
                if (logEntry) {
                    if (logEntry.error()) {
                        const msg = `${options.getWarpOptions().debugLogHeader}<<warp://${classKey.warpKey.getName()}>> ${logEntry.message()}`;
                        console.error(msg);
                    } else {
                        const msg = `${options.getWarpOptions().debugLogHeader}<<warp://${classKey.warpKey.getName()}>> ${logEntry.message()}`;
                        console.log(msg);
                    }
                } else {
                    logWarn(logContext, "There was a warp-side console log message that couldn't be read because the data was empty or invalid.")
                }
            }
        }

        if (!response.response)
            throw getErrorForNotOkResponse(logContext, response);

        let tracker;
        if (response.messages && response.messages.length > 0) {
            const eventMessages = new Array<MessageMessageProto>();
            const updateMessages = new Array<DataUpdateMessageProto>();
            for (const messageUnionProto of response.messages) {
                switch (messageUnionProto.valueType()) {
                    case UserMessageUnionProto.DataUpdateMessageProto: {
                        const update = messageUnionProto.value(new DataUpdateMessageProto());
                        if (!update)
                            throw new Error(logError(logContext, 'Unable to read object update message because it was empty'));
                        updateMessages.push(update);
                        break;
                    }
                    case UserMessageUnionProto.MessageMessageProto: {
                        const event = messageUnionProto.value(new MessageMessageProto());
                        if (!event)
                            throw new Error(logError(logContext, "Unable to read object update message because it contained an empty event object"));
                        eventMessages.push(event);
                        break;
                    }
                    default:
                        throw new Error(logError(logContext, "Unable to read message because it contained invalid data"));
                }
            }
            //Handle events first
            for (const eventMessageProto of eventMessages) {
                //[sic] This uses its own tracker because events must be fired at consistent state.
                await handleMessageMessageWithTrackerAsync(logContext, classKey.warpKey, eventMessageProto);
            }
            for (const objectUpdateProto of updateMessages) {
                if (!tracker)
                    tracker = new Tracker();
                handleDataUpdateMessage(logContext, classKey.warpKey, objectUpdateProto, tracker);
            }
        }

        if (!tracker)
            tracker = new Tracker();

        // Get the return value
        const valueProto = response.response.returnValue(new ValueProto());
        if (!valueProto)
            throw new Error(logError(logContext, "Unable to read return value because it contained invalid data"));
        const {type, value} = deserializeValue(logContext, classKey.warpKey, valueProto, tracker);

        let returnValue = null;
        if(type == ValueUnionProto.DataReferenceValueProto) {
            tracker.dataResolutionQueue.enqueue(<DataKey> value, maybeData => {
                returnValue = maybeData;
            });
        } else {
            returnValue = value;
        }

        await tracker.applyOnceAsync(logContext);

        return returnValue;
    }

    async getDataAsync(logContext: string, objectKey: DataKey, tracker: Tracker): Promise<Data | null> {
        requiresTruthy('logContext', logContext);
        requiresTruthy('objectKey', objectKey);

        const warpKey = objectKey.classKey.warpKey;
        const riverClient = await getRiverClientAsync(warpKey);
        const response = await riverClient.getDataAsync(logContext, objectKey);

        if (!response.response)
            throw getErrorForNotOkResponse(logContext, response);

        let target = null;

        //Load all the warp objects
        for (let i = 0; i < response.response.dataLength(); ++i) {
            const dataProto = response.response.data(i, new NestedDataProto());
            if (!dataProto)
                throw new Error(logError(logContext, "Unable to read response because a warp object contained invalid data"));
            const object = replaceData(logContext, warpKey, dataProto, tracker);
            if (object && dataProto.classId() === objectKey.classKey.classId && dataProto.primaryKey() == objectKey.primaryKey) {
                target = object;
            }
        }

        if (!target) {
            logWarn(logContext, `Call to getDataAsync with ${objectKey.getFullyQualifiedName()} returned a deleted object so nothing was actually returned`);
        }

        return target;
    }
}

export const client = new Client();
