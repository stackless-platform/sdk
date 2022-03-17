import {sysLogError} from "../util/logging.js";
import {openRiverClientAsync, RiverClient} from "./river-client.js";
import {WarpRegistry} from "../util/registry.js";
import {
    handleMessageMessageWithTrackerAsync,
    handleDataUpdateMessageWithTrackerAsync
} from "../util/update-handler.js";
import {WarpKey} from "../internal-model-types.js";

export async function getRiverClientAsync(warpKey: WarpKey): Promise<RiverClient> {
    let riverClient = WarpRegistry.instance.tryGetRiverClient(warpKey);
    if (riverClient)
        return riverClient;

    let userKey = WarpRegistry.instance.getUserKey(warpKey);

    try {
        riverClient = await openRiverClientAsync(warpKey, userKey, handleDataUpdateMessageWithTrackerAsync, handleMessageMessageWithTrackerAsync);
    } catch (reason) {
        throw new Error(sysLogError(`Unable to open connection to the StacklessJS platform. Reason: ${JSON.stringify(reason)}`));
    }

    WarpRegistry.instance.setRiverClient(warpKey, riverClient);
    return riverClient;
}