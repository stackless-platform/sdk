import {requiresAtLeastOneElement, requiresTruthy} from "./requires.js";
import {MessageRegistry, DataRegistry} from "./registry.js";
import {logVerbose} from "./logging.js";
import {Message, Data, DataUpdatedEvent} from "../../public/model-types.js";
import {MessageInstanceKey, DataKey} from "../internal-model-types.js";
import {runtime} from "../runtime.js";

class DataUpdatedFiringQueue {
    private _queue: { object: Data, deleted: boolean } [];

    constructor() {
        this._queue = [];
    }

    public enqueue(object: Data, deleted: boolean): void {
        requiresTruthy('object', object);
        this._queue.push({object: object, deleted: deleted});
    }

    public async applyOnceAsync(logContext: string) {
        for (const {object, deleted} of this._queue) {
            const listeners = DataRegistry.instance.tryGetUpdatedListeners(object);
            if (listeners) {
                const objectKey = DataRegistry.instance.getDataKey(object);
                for (const listener of listeners) {
                    const ret = listener(new DataUpdatedEvent(object, deleted));
                    if (ret instanceof Promise)
                        await ret;
                }
                logVerbose(logContext, `Object update to ${objectKey.getFullyQualifiedName()} handled by ${listeners.length} listeners`);
            }
        }
        this._queue = [];
    }
}

class DataDeleteQueue {
    private _queue: DataKey[];

    constructor() {
        this._queue = [];
    }

    public enqueue(objectKey: DataKey): void {
        requiresTruthy('objectKey', objectKey);
        this._queue.push(objectKey);
    }

    public applyOnce(logContext: string) {
        requiresTruthy('logContext', logContext);
        this._queue.forEach(objectKey => {
            DataRegistry.instance.remove(objectKey);
            logVerbose(logContext, `Object ${objectKey.getFullyQualifiedName()} deleted`)
        });
        this._queue = [];
    }
}

class MessageFiringQueue {
    private _queue: { event: Message, instanceKey: MessageInstanceKey }[];

    constructor() {
        this._queue = [];
    }

    public enqueue(instanceKey: MessageInstanceKey, event: Message): void {
        requiresTruthy('instanceKey', instanceKey);
        requiresTruthy('event', event);
        this._queue.push({event: event, instanceKey: instanceKey});
    }

    public async applyOnceAsync(logContext: string) {
        requiresTruthy('logContext', logContext);
        for (const value of this._queue) {
            const {event, instanceKey} = value;
            const listeners = MessageRegistry.instance.tryGetListeners(instanceKey);
            if (listeners) {
                for (const listener of listeners) {
                    const ret = listener(event);
                    if (ret instanceof Promise) {
                        await ret;
                    }
                }
                logVerbose(logContext, `Event ${instanceKey.getFullyQualifiedName()} handled by ${listeners.length} listeners`);
            }
        }
        this._queue = [];
    }
}

export type MaybeMultiDataResolved = (dataMap: Map<DataKey, Data | null>) => void;
export type MaybeSingleDataResolved = (maybeData: Data | null) => void;

class SingleResolutionItem {
    constructor(public objectKey: DataKey, public maybeResolved: MaybeSingleDataResolved | null) {
        requiresTruthy('objectKey', objectKey);
    }
}

class MultiResolutionItem {
    constructor(public objectKeys: DataKey[], public maybeResolved: MaybeMultiDataResolved | null) {
        requiresAtLeastOneElement('objectKeys', objectKeys);
    }
}

type ResolutionItem = SingleResolutionItem | MultiResolutionItem;

class DataResolutionQueue {
    private _queue: ResolutionItem [];
    private readonly _tracker: Tracker;

    constructor(tracker: Tracker) {
        requiresTruthy("tracker", tracker);
        this._queue = [];
        this._tracker = tracker;
    }

    public enqueueMultiple<T extends Data>(objectKeys: DataKey[], maybeResolved: MaybeMultiDataResolved | null): void {
        this._queue.push(new MultiResolutionItem(objectKeys, maybeResolved));
    }

    public enqueue<T extends Data>(objectKey: DataKey, maybeResolved: MaybeSingleDataResolved | null): void {
        this._queue.push(new SingleResolutionItem(objectKey, maybeResolved));
    }

    public async applyOnceAsync(logContext: string) {
        requiresTruthy('logContext', logContext);
        while (this._queue.length > 0) {
            const queue = this._queue.slice();
            this._queue = [];
            for (const item of queue) {
                if (item instanceof SingleResolutionItem) {
                    let value = DataRegistry.instance.tryGetInstance(item.objectKey);
                    if (!value) {
                        value = await runtime.getDataAsync(logContext, item.objectKey, this._tracker);
                    }
                    if (item.maybeResolved)
                        item.maybeResolved(value);
                } else {
                    let keysAndValues = new Map<DataKey, Data | null>();
                    for (let objectKey of item.objectKeys) {
                        let value = DataRegistry.instance.tryGetInstance(objectKey);
                        if (!value) {
                            value = await runtime.getDataAsync(logContext, objectKey, this._tracker);
                        }
                        keysAndValues.set(objectKey, value);
                    }
                    if (item.maybeResolved)
                        item.maybeResolved(keysAndValues);
                }
            }
        }
    }
}

export class Tracker {
    public dataResolutionQueue: DataResolutionQueue;
    public messageFiringQueue: MessageFiringQueue;
    public dataDeleteQueue: DataDeleteQueue;
    public dataUpdatedFiringQueue: DataUpdatedFiringQueue;

    constructor() {
        this.dataResolutionQueue = new DataResolutionQueue(this);
        this.messageFiringQueue = new MessageFiringQueue();
        this.dataDeleteQueue = new DataDeleteQueue();
        this.dataUpdatedFiringQueue = new DataUpdatedFiringQueue();
    }

    async applyOnceAsync(logContext: string) {
        //Resolve all objects
        await this.dataResolutionQueue.applyOnceAsync(logContext);
        //Fire all Message handlers
        await this.messageFiringQueue.applyOnceAsync(logContext);
        //Fire all the DataUpdated handlers
        await this.dataUpdatedFiringQueue.applyOnceAsync(logContext);
        //Deletes all the objects that need to be deleted.
        this.dataDeleteQueue.applyOnce(logContext);
    }
}