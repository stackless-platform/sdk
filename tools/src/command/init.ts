import path from "path";
import {AdminKeyFile} from "../model/admin-key-file";
import {logLocalError, logSuccess, logVerbose} from "../util/logging";
import fs from 'fs';
import {validateWarpNameOrErrorAsync, warpNameValidatorAsync} from "../util/validators";
import chalk from "chalk";
import inquirer from "inquirer";
import {Command, program} from "commander";
import {WarpIdentity, WarpConfig} from "../model/warp-config";
import {maybeExecuteLoginAsync} from "./account-login";

async function promptWarpNameAsync(): Promise<string> {
    console.log("Give your new warp a name.");
    console.log(chalk.gray("It must be between 3 and 50 characters and contain only letters, numbers, and the characters - and _.\n" +
        "The name you choose should indicate what it does or give you an idea what types of classes it contains.\n" +
        "Examples: MyGame or my-game"));
    const answer = await inquirer.prompt([{
        name: 'warpName',
        message: 'Warp name:',
        validate: warpNameValidatorAsync
    }]);
    return answer.warpName;
}

function writeKernelIndexDTs(dir: string): string {
    let indexDTsFile = path.resolve(__dirname, "..", "templates", "kernel-index.d.ts");
    let kernelDir = path.resolve(dir, "warp-runtime");
    if (!fs.existsSync(kernelDir))
        fs.mkdirSync(kernelDir);
    let targetIndexDTsFile = path.resolve(kernelDir, "index.d.ts");
    fs.copyFileSync(indexDTsFile, targetIndexDTsFile);
    return targetIndexDTsFile;
}

export function createInitProgramCommand(before: any): any {
    program.command('init [warpName] [dir]')
        .description('Initialize [dir] as a new warp named [warpName]. The current directory is used if not specified.')
        .option("--no-login", "Fail when not logged in instead of prompting.")
        .action(async (warpName: string, dir:string, cmd: Command) => {
            if (before)
                before();
            dir = dir || process.cwd();
            let opts = cmd.opts();

            if (await executeInitAsync(dir, warpName, opts.login)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function executeInitAsync(dir: string, warpName: string | null, login: boolean): Promise<boolean> {
    if (!await maybeExecuteLoginAsync(login)) {
        return false;
    }

    if (WarpConfig.fileExists(dir)) {
        logLocalError(`${dir} is already a warp.`);
        return false;
    }

    if (!warpName) {
        warpName = await promptWarpNameAsync();
    } else {
        if (!await validateWarpNameOrErrorAsync(warpName)) {
            return false;
        }
    }

    //get the key file
    const keyFile = AdminKeyFile.tryOpen();
    if (!keyFile) {
        return false;
    }

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }

    //Write the warp source config file
    let warpSrcIdentity = new WarpIdentity(keyFile.adminKey);
    let warpSrcConfig = new WarpConfig(warpName, [], warpSrcIdentity);
    let warpSrcConfigFile = warpSrcConfig.writeToDir(dir);
    logVerbose(`Wrote ${warpSrcConfigFile}`);

    const indexDTsFile = writeKernelIndexDTs(dir);
    logVerbose(`Wrote ${indexDTsFile}`);

    logSuccess("Warp created successfully!");
    return true;
}