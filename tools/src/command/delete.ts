import {program} from "commander";
import {logRemoteError, logOk} from "../util/logging.js";
import {JayneSingleton} from "../service/jayne.js";
import {createLogContext} from "../util/log-context.js";
import {executeLoginAsync} from "./account-login.js";
import {AdminKeyFile} from "../model/admin-key-file.js";

export function createDeleteProgramCommand(before: any) {
    program.command('delete <warpName>')
        .description('Delete the warp from the Stackless platform and all its data.')
        .requiredOption("--yes-im-sure-i-want-to-delete-this-warp", "Required because this operation is destructive and cannot be undone (even by Stackless support).")
        .action(async (warpName: string) => {
            if (before)
                before();
            if (await executeDeleteAsync(warpName, true)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function executeDeleteAsync(warpName: string, login: boolean): Promise<boolean> {
    // Force an interactive login because this is destructive.
    if(login) {
        console.log("Because this is a destructive operation, you must re-login.")
        if (!await executeLoginAsync(null, true, true)) {
            return false;
        }
    }

    //get the admin key file from the login
    let adminKeyFile = AdminKeyFile.tryOpen();
    if (!adminKeyFile) {
        return false;
    }
    let adminKey = adminKeyFile.adminKey;

    const logContext = createLogContext();
    try {
        await JayneSingleton.deleteWarpAsync(logContext, adminKey, warpName);
        logOk(`Warp ${warpName} deleted successfully.`);
        return true;
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return false;
    }
}