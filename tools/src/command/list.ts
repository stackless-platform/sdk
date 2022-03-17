import {Command, program} from "commander";
import {AdminKeyFile} from "../model/admin-key-file";
import {logRemoteError} from "../util/logging";
import {maybeExecuteLoginAsync} from "./account-login";
import {JayneSingleton} from "../service/jayne";
import {createLogContext} from "../util/log-context";

export function createListProgramCommand(before: any) {
    program.command('list')
        .description('Display the list of warps available to your account.')
        .option("--no-login", "Fail when not logged in instead of prompting")
        .action(async (cmd: Command) => {
            if (before)
                before();
            const opts = cmd.opts();
            if (await executeListAsync(opts.login)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function getOwnedWarpsAsync(login: boolean): Promise<string[] | null> {
    if (!await maybeExecuteLoginAsync(login)) {
        return null;
    }

    //get the admin key file from the login
    let adminKeyFile = AdminKeyFile.tryOpen();
    if (!adminKeyFile) {
        return null;
    }

    const logContext = createLogContext();
    try {
        const response = await JayneSingleton.listWarpsAsync(logContext, adminKeyFile.adminKey);
        if(response.ownedWarps && response.ownedWarps.length > 0) {
            return response.ownedWarps;
        } else {
            console.log("No warps found");
            return null;
        }
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return null;
    }
}

export async function executeListAsync(login: boolean): Promise<boolean> {
    const ownedWarps = await getOwnedWarpsAsync(login);
    if(!ownedWarps) {
        return true;
    }
    for(let ownedWarp of ownedWarps) {
        console.log(ownedWarp);
    }
    return true;
}