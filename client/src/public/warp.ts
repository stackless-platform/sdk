import {MessageRegistry, DataRegistry, WarpRegistry, ServiceRegistry} from "../internal/util/registry.js";
import {createLogContext, logError, sysLogError} from "../internal/util/logging.js";
import {
    friendlyArgumentRequired,
    friendlyArrayArgumentRequired,
    getErrorForNotOkResponse,
    getDataAndKeyMap,
    getDataAndKeys,
    normalizeArrayArg
} from "../internal/util/serde.js";

import {UserMessageUnionProto} from "../internal/protocol/user-message-union-proto.js";
import {DataUpdateMessageProto} from "../internal/protocol/data-update-message-proto.js";

import {Tracker} from "../internal/util/tracker.js";
import {getRiverClientAsync} from "../internal/service/river-client-factory.js";
import {handleDataUpdateMessage} from "../internal/util/update-handler.js";
import {client} from "../internal/client.js";
import {
    Data,
    Service,
    Message,
    DataConstructor,
    ServiceConstructor,
    MessageConstructor,
    MessageListener,
    DataUpdateListener
} from "./model-types.js";
import {MessageInstanceKey, MessageSourceKey, DataKey, ServiceKey} from "../internal/internal-model-types.js";
import {options} from "../internal/options.js";
import {WarpOptions} from "./warp-options.js"

function maybeGetMessageSourceKey<T extends Data | Service>(source: T): MessageSourceKey | null {
    if (source instanceof Data) {
        return DataRegistry.instance.getDataKey(source);
    } else if (source instanceof Service) {
        const classKey = ServiceRegistry.instance.getClassKey(source.constructor);
        return new ServiceKey(classKey, source.primaryKey);
    } else {
        return null;
    }
}

class Warp {
    /**
     * (async) Retrieves an existing instance of a Data-derived class from warp space and returns it.
     * @param {DataConstructor<T>} dataType - The type of the object to get. E.g. The Player class that extends Data.
     * @param {string} primaryKey - The primary key of the object to get.
     * @return {Promise<T | null>} A promise that resolves to the object instance or null if the object wasn't found.
     * @throws {Error} When a failure occurs when talking to the warp.
     * */
    async getDataAsync<T extends Data>(dataType: DataConstructor<T>, primaryKey: string): Promise<T | null> {
        friendlyArgumentRequired('dataType', dataType);
        friendlyArgumentRequired('primaryKey', primaryKey);

        const classKey = DataRegistry.instance.getClassKey(dataType);
        const objectKey = new DataKey(classKey, primaryKey);
        const logContext = createLogContext();

        const tracker = new Tracker();
        const object = await client.getDataAsync(logContext, objectKey, tracker);
        await tracker.applyOnceAsync(logContext);

        return <T><unknown>object;
    }

    /**
     * (async) Pushes one or more Data-derived instances to warp space and saves them to the datastore. Their changes are broadcasted to other clients listening for changes on those objects.
     * @see subscribeUpdatesAsync
     * @see addUpdateListener
     * @param {Data[]} data - The objects to save.
     * @return {Promise<void>} A promise that resolves when the object has been saved.
     * @throws {Error} When a failure occurs when talking to the warp.
     */
    async saveDataAsync(...data: Data[]): Promise<void> {
        friendlyArrayArgumentRequired('data', data);

        const {warpKey, objects} = getDataAndKeyMap(data);

        const logContext = createLogContext();
        const riverClient = await getRiverClientAsync(warpKey);
        const response = await riverClient.saveDataAsync(logContext, objects);

        if (!response.response)
            throw getErrorForNotOkResponse(logContext, response);

        const tracker = new Tracker();
        if (response.messages && response.messages.length > 0) {
            for (let message of response.messages) {
                switch (message.valueType()) {
                    case UserMessageUnionProto.DataUpdateMessageProto: {
                        const update = message.value(new DataUpdateMessageProto());
                        if (!update)
                            throw new Error(logError(logContext, 'Unable to read object update message because it was empty'));
                        handleDataUpdateMessage(logContext, warpKey, update, tracker);
                        break;
                    }
                    case UserMessageUnionProto.MessageMessageProto:
                        throw new Error(logError(logContext, 'Unexpectedly recieved Message from save data call.'));
                    default:
                        throw new Error(logError(logContext, "Unable to read message because it contained invalid data"));
                }
            }
        }
        await tracker.applyOnceAsync(logContext);
    }

    /**
     * Closes all open warp connections and removes all Message and Data listeners.
     * This doesn't prevent new connections from being made nor new Message / data listeners from being setup and used.
     * */
    closeConnections() {
        WarpRegistry.instance.clearRiverClients();
        MessageRegistry.instance.clearAllListeners();
        DataRegistry.instance.clearAllUpdateListeners();
    }

    /**
     * Gets an instance of a Service. This doesn't make a network call.
     * @param {ServiceConstructor<T>} serviceType - The type of the service to get. E.g. The MyService class that extends Service.
     * @param {string} primaryKey - The primary key of the service to get.
     * @return {T} The service instance.
     * */
    getService<T extends Service>(serviceType: ServiceConstructor<T>, primaryKey: string): T {
        friendlyArgumentRequired('serviceType', serviceType);
        friendlyArgumentRequired('primaryKey', primaryKey);

        const classKey = ServiceRegistry.instance.getClassKey(serviceType);
        const serviceKey = new ServiceKey(classKey, primaryKey);
        return <T><unknown>ServiceRegistry.instance.createInstance(serviceKey);
    }

    /**
     * Removes a message listener so it is no longer handled by this client. Note: This does not unsubscribe this client from the message all together, this mearly removes the listener function handler. (note: A message subscription can have multiple listeners)
     * @param { TS } source - The source Data or Service that was passed to the previous subscribeMessageAsync call.
     * @param {MessageConstructor<TM>} messageType - The type of the message to remove the listener from.
     * @param {MessageListener} listener - The function instance you no longer wish to be called.
     * */
    removeMessageListener<TS extends Data | Service, TM extends Message>(source: TS, messageType: MessageConstructor<TM>, listener: MessageListener) {
        friendlyArgumentRequired('source', source);
        friendlyArgumentRequired('messageType', messageType);
        friendlyArgumentRequired('listener', listener);
        const sourceKey = maybeGetMessageSourceKey(source)
        if (!sourceKey)
            throw new Error(sysLogError("Invalid message source."));
        const messageClassKey = MessageRegistry.instance.getClassKey(messageType);
        const messageInstanceKey = new MessageInstanceKey(messageClassKey, sourceKey);

        MessageRegistry.instance.removeListener(messageInstanceKey, listener);
    }

    /**
     * (async) Subscribes this client to a Message so that when a warp service sends it, this client receives it and calls the listener function.
     * @see unsubscribeMessageAsync
     * @param { TS } source - The source Data or Service to subscribe to.
     * @param {MessageConstructor<TM>} messageType - The type of the message to subscribe to. E.g. The PlayerAdded class that extends Message.
     * @param {MessageListener} listener - The function instance to be called to handle the message.
     * @return {Promise<void>} A promise that resolves when the warp has subscribed this client to the message.
     * @throws {Error} When a failure occurs when talking to the warp.
     * */
    async subscribeMessageAsync<TS extends Data | Service, TM extends Message>(source: Data | Service, messageType: MessageConstructor<TM>, listener: MessageListener): Promise<void> {
        friendlyArgumentRequired('source', source);
        friendlyArgumentRequired('messageType', messageType);
        friendlyArgumentRequired('listener', listener);

        const sourceKey = maybeGetMessageSourceKey(source);
        if (!sourceKey)
            throw new Error(sysLogError("Invalid message source."));

        const messageClassKey = MessageRegistry.instance.getClassKey(messageType);

        const messageInstanceKey = new MessageInstanceKey(messageClassKey, sourceKey);

        if (MessageRegistry.instance.tryGetListeners(messageInstanceKey)) {
            MessageRegistry.instance.addListener(messageInstanceKey, listener);
            return;
        }

        const riverClient = await getRiverClientAsync(messageClassKey.warpKey);

        const logContext = createLogContext();
        const response = await riverClient.subscribeMessageAsync(logContext, messageInstanceKey);

        if (response.response) {
            MessageRegistry.instance.addListener(messageInstanceKey, listener);
        } else {
            throw getErrorForNotOkResponse(logContext, response);
        }
    }

    /**
     * (async) Unsubscribes this client from the Message so that it no longer handles it. This also removes all listeners.
     * @see subscribeMessageAsync
     * @param { TS } source - The source Data or Service that was passed to the previous subscribeMessageAsync call.
     * @param {MessageConstructor<TM>} messageType - The type of the message to unsubscribe from. E.g. The PlayerAdded class that extends Message.
     * @return {Promise<void>} A promise that resolves when the warp has unsubscribed this client from the message.
     * @throws {Error} When a failure occurs when talking to the warp.
     * */
    async unsubscribeMessageAsync<TS extends Data | Service, TM extends Message>(source: TS, messageType: MessageConstructor<TM>): Promise<void> {
        friendlyArgumentRequired('messageType', messageType);

        const sourceKey = maybeGetMessageSourceKey(source);
        if (!sourceKey)
            throw new Error(sysLogError("Invalid message source."));

        const messageClassKey = MessageRegistry.instance.getClassKey(messageType);
        const messageInstanceKey = new MessageInstanceKey(messageClassKey, sourceKey);

        const riverClient = await getRiverClientAsync(messageClassKey.warpKey);

        const logContext = createLogContext();
        const response = await riverClient.unsubscribeMessageAsync(logContext, messageInstanceKey);

        if (response.response) {
            MessageRegistry.instance.clearListeners(messageInstanceKey);
        } else {
            throw getErrorForNotOkResponse(logContext, response);
        }
    }

    /**
     * Removes all update listeners from one or more Data. This does not unsubscribe the objects from updates, it mearly removes all local update listener handlers.
     * @see unsubscribeUpdatesAsync
     * @see removeUpdateListener
     * @param {Data | Data[]} data - The objects to remove all update listeners.
     */
    clearUpdateListeners(data: Data | Data[]) {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);
        const objects = normalizeArrayArg(data);
        for (const object of objects) {
            DataRegistry.instance.clearUpdatedListeners(object);
        }
    }

    /**
     * Removes the update listener from one or more Data. This does not unsubscribe the objects from updates, it mearly removes the local update listener handler.
     * @param {Data | Data[]} data - The objects to remove the update listener from.
     * @param {DataUpdateListener} listener - The listener function to remove.
     */
    removeUpdateListener(data: Data | Data[], listener: DataUpdateListener) {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);
        friendlyArgumentRequired('listener', listener);
        const objects = normalizeArrayArg(data);
        for (const object of objects) {
            DataRegistry.instance.removeUpdatedListener(object, listener);
        }
    }

    /**
     * Adds an update listener to one or more Data so that when an update is received the listener is called. This does not subscribe the objects to updates.
     * @see subscribeUpdatesAsync
     * @param {Data | Data[]} data - The objects to add the listener to.
     * @param {DataUpdateListener} listener - The listener function to add.
     * */
    addUpdateListener(data: Data | Data[], listener: DataUpdateListener) {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);
        friendlyArgumentRequired('listener', listener);
        const objects = normalizeArrayArg(data);
        for (const object of objects) {
            DataRegistry.instance.addUpdatedListener(object, listener);
        }
    }

    /**
     * (async) Subscribes one or more Data instances to updates so that when other clients (or services) make changes to them, the changes are sent to this client so the objects are kept up to date automatically.
     * @see addUpdateListener
     * @param {Data | Data[]} data - The objects to subscribe. E.g. An instance of the Player class that extends Data.
     * @return {Promise<void>} A promise that resolves when the warp has subscribed this client to object updates made to the objects in question.
     * @throws {Error} When a failure occurs when talking to the warp.
     * */
    async subscribeUpdatesAsync(data: Data | Data[]): Promise<void> {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);

        const {warpKey, dataKeys} = getDataAndKeys(data);

        const riverClient = await getRiverClientAsync(warpKey);
        const logContext = createLogContext();
        const response = await riverClient.subscribeDataUpdatesAsync(logContext, dataKeys);

        if (!response.response) {
            throw getErrorForNotOkResponse(logContext, response);
        }
    }

    /**
     * (async) Unsubscribes one or more Data instances from updates so they no longer receive changes made by other clients (or services).
     * @see subscribeUpdatesAsync
     * @param {Data | Data[]} data - The objects to unsubscribe. E.g. An instance of the Player class that extends Data.
     * @return {Promise<void>} A promise that resolves when the warp has unsubscribed this client from object updates made to the objects in question.
     * @throws {Error} When a failure occurs when talking to the warp.
     * */
    async unsubscribeUpdatesAsync(data: Data | Data[]): Promise<void> {
        if (data instanceof Array)
            friendlyArrayArgumentRequired('data', data);
        else
            friendlyArgumentRequired('data', data);

        const {warpKey, dataKeys} = getDataAndKeys(data);

        const riverClient = await getRiverClientAsync(warpKey);

        const logContext = createLogContext();
        const response = await riverClient.unsubscribeDataUpdatesAsync(logContext, dataKeys);

        if (!response.response) {
            throw getErrorForNotOkResponse(logContext, response);
        }
    }

    /**
     * Set the warp's options.
     * */
    setOptions(warpOptions: WarpOptions) {
        options.setWarpOptions(warpOptions);
    }

    /**
     * Gets the warp's options.
     * */
    getOptions() : WarpOptions {
        return options.getWarpOptions();
    }
}

export const warp = new Warp();