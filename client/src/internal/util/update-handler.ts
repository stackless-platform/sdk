import {ByteBuffer} from "flatbuffers";
import {MessageMessageProto} from "../protocol/message-message-proto.js";
import {requiresTruthy} from "./requires.js";
import {logError, logVerbose, sysLogError} from "./logging.js";
import {MessageProto} from "../protocol/message-proto.js";
import {WarpReferenceUnionProto} from "../protocol/warp-reference-union-proto.js";
import {DataReferenceValueProto} from "../protocol/data-reference-value-proto.js";
import {ServiceReferenceValueProto} from "../protocol/service-reference-value-proto.js";
import {Tracker} from "./tracker.js";
import {deserializeValue, mergeDelta, readProperty, unwrapBytes} from "./serde.js";
import {DataDeltaProto} from "../protocol/data-delta-proto.js";
import {DataUpdateMessageProto} from "../protocol/data-update-message-proto.js";
import {
    createMessageInstance,
    MessageClassKey,
    MessageInstanceKey,
    WarpKey,
    DataClassKey,
    DataKey,
    ServiceClassKey,
    ServiceKey
} from "../internal-model-types.js";
import {ValueUnionProto} from "../protocol/value-union-proto.js";

export async function handleMessageMessageWithTrackerAsync(logContext: string, warpKey: WarpKey, messageMessageProto: MessageMessageProto): Promise<void> {
    requiresTruthy('logContext', logContext);
    requiresTruthy('warpKey', warpKey);
    requiresTruthy('messageMessageProto', messageMessageProto);

    logVerbose(logContext, `Handling warp event for warp ${warpKey.getFullyQualifiedName()}`);

    const messageBytesProto = messageMessageProto.event();
    if (!messageBytesProto)
        throw new Error(logError(logContext, 'Unable to handle event message because the event message contained invalid bytes'));
    const bytesArray = messageBytesProto.bytesArray();
    if (!bytesArray)
        throw new Error(logError(logContext, 'Unable to handle event message because the event message contained and invalid byte array'));
    const eventProto = MessageProto.getRootAsMessageProto(new ByteBuffer(bytesArray), new MessageProto());
    const messageClassKey = new MessageClassKey(warpKey, eventProto.classId());

    let eventInstanceKey;
    if(eventProto.sourceType() == WarpReferenceUnionProto.DataReferenceValueProto) {
        const ref = <DataReferenceValueProto>eventProto.source(new DataReferenceValueProto());
        eventInstanceKey = new MessageInstanceKey(messageClassKey, new DataKey(new DataClassKey(warpKey, ref.classId()), <string>ref.primaryKey()));
    } else if(eventProto.sourceType() == WarpReferenceUnionProto.ServiceReferenceValueProto) {
        const ref = <ServiceReferenceValueProto>eventProto.source(new ServiceReferenceValueProto());
        eventInstanceKey = new MessageInstanceKey(messageClassKey, new ServiceKey(new ServiceClassKey(warpKey, ref.classId()), <string>ref.primaryKey()));
    } else {
        throw new Error(sysLogError("Unknown event source type."));
    }

    const event = createMessageInstance(messageClassKey);

    const tracker = new Tracker(); //must use its own tracker because events are fired as near the state the server fired the event from.

    //Merge the deltas
    if (messageMessageProto.deltasLength()) {
        for (let i = 0; i < messageMessageProto.deltasLength(); ++i) {
            const deltaBytesProto = messageMessageProto.deltas(i);
            if (!deltaBytesProto)
                throw new Error(logError(logContext, 'Unable to handle event message because a referenced warp object delta contained invalid data'));
            const deltaProto = unwrapBytes(logContext, deltaBytesProto.bytesArray(), DataDeltaProto);
            mergeDelta(logContext, warpKey, deltaProto, tracker);
        }
    }

    //Read all the event properties
    for (let i = 0; i < eventProto.propertiesLength(); ++i) {
        const {name, valueProto} = readProperty(logContext, messageClassKey, eventProto.properties(i));
        const {type, value} = deserializeValue(logContext, warpKey, valueProto, tracker);
        if(type == ValueUnionProto.DataReferenceValueProto) {
            tracker.dataResolutionQueue.enqueue(<DataKey> value, maybeData => {
                Object.defineProperty(event, name, {
                    value: maybeData,
                    configurable: false,
                    enumerable: true,
                    writable: true
                });
            });
        } else {
            Object.defineProperty(event, name, {
                value: value,
                configurable: false,
                enumerable: true,
                writable: true
            });
        }
    }

    tracker.messageFiringQueue.enqueue(eventInstanceKey, event);
    await tracker.applyOnceAsync(logContext);
}

export function handleDataUpdateMessage(logContext: string, warpKey: WarpKey, dataUpdateMessageProto: DataUpdateMessageProto, tracker: Tracker): void {
    requiresTruthy('logContext', logContext);
    requiresTruthy('warpKey', warpKey);
    requiresTruthy('dataUpdateMessageProto', dataUpdateMessageProto);
    requiresTruthy('tracker', tracker);

    for (let i = 0; i < dataUpdateMessageProto.deltasLength(); ++i) {
        const deltaBytesProto = dataUpdateMessageProto.deltas(i);
        if (!deltaBytesProto)
            throw new Error(logError(logContext, "Unable to read object update message bytes proto because it contained invalid data"));
        const bytes = deltaBytesProto.bytesArray();
        if (!bytes)
            throw new Error(logError(logContext, "Unable to read object update message bytes because it contained invalid data"));
        const delta = DataDeltaProto.getRootAsDataDeltaProto(new ByteBuffer(bytes));
        mergeDelta(logContext, warpKey, delta, tracker);
    }
    logVerbose(logContext, `Handled object update message containing ${dataUpdateMessageProto.deltasLength()} deltas`);
}

export async function handleDataUpdateMessageWithTrackerAsync(logContext: string, warpKey: WarpKey, dataUpdateMessageProto: DataUpdateMessageProto): Promise<void> {
    const tracker = new Tracker();
    handleDataUpdateMessage(logContext, warpKey, dataUpdateMessageProto, tracker);
    await tracker.applyOnceAsync(logContext);
}