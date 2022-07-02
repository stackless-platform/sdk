import chalk from "chalk";
import {logRemoteError, logOk, logWarning, logLocalError, logNotice, logDetails} from "../util/logging";
import fs from "fs";
import {Command, program} from "commander";
import {maybeExecuteLoginAsync} from "./account-login";
import {validateWarpNameOrErrorAsync} from "../util/validators";
import {JayneSingleton} from "../service/jayne";
import {AdminKeyFile} from "../model/admin-key-file";
import {deserializeWarpIndex} from "../util/deserializer";
import path from "path";
import {createClient} from "../util/client-generator";
import {createLogContext} from "../util/log-context";

const CLIENT_LIB_NAME = "warp-client";

function getBuildKeyAndRegenerateCommand(warpName: string): [string, string] {
    let buildKey = `connect-${warpName.toLowerCase()}`;
    return [buildKey, `npm run ${buildKey}`];
}

function updatePackageJson(packageJsonFile: string, warpName: string, updateBuild: boolean, warpPackageName: string, relRootPath: string) {
    const command = `warp connect ${warpName.toLowerCase()} --ci`;

    let packageJsonStr = fs.readFileSync(packageJsonFile, {encoding: "utf8"});
    let indentionRule = getPackageJsonIndentionRule(packageJsonStr);
    let packageJsonObj = JSON.parse(packageJsonStr);

    if (updateBuild) {
        let [buildKey, npmRunCommand] = getBuildKeyAndRegenerateCommand(warpName);

        if (!packageJsonObj.hasOwnProperty("scripts")) {
            packageJsonObj.scripts = {};
        }

        if (!packageJsonObj.scripts.hasOwnProperty(buildKey)) {
            packageJsonObj.scripts[buildKey] = command;
        } else {
            if (packageJsonObj.scripts[buildKey] !== command) {
                packageJsonObj.scripts[buildKey] = command;
            }
        }

        if (!packageJsonObj.scripts.hasOwnProperty("build")) {
            packageJsonObj.scripts.build = "npm run " + buildKey;
        } else {
            if (!packageJsonObj.scripts.build.includes(npmRunCommand)) {
                packageJsonObj.scripts.build = `${npmRunCommand} && ${packageJsonObj.scripts.build}`;
            }
        }
    }

    if (!packageJsonObj.hasOwnProperty("dependencies")) {
        packageJsonObj.dependencies = {};
    }

    packageJsonObj.dependencies[CLIENT_LIB_NAME] = "latest";
    packageJsonObj.dependencies[warpPackageName] = `file:./${relRootPath}`

    const indent = indentionRule.spaces ? indentionRule.count : "\t";
    let updatedPackageJsonStr = JSON.stringify(packageJsonObj, null, indent);
    fs.writeFileSync(packageJsonFile, updatedPackageJsonStr);
}

function getPackageJsonIndentionRule(jsonStr: string): any {
    const def = {spaces: true, count: 2};
    const re = /^(\s*)"name"/m;
    let match = re.exec(jsonStr);
    if (!match) {
        logWarning("Unknown indention found in package.json, using npm default of 2 spaces");
        return def;
    }
    const spaceCount = (match[1].match(/ /g) || []).length;
    const tabCount = (match[1].match(/\t/g) || []).length;
    if (spaceCount && tabCount) {
        logWarning("Inconsistent indention found in package.json, using npm default of 2 spaces");
        return def;
    }
    if (!spaceCount && !tabCount) {
        logWarning("Unknown indention found in package.json, using npm default of 2 spaces");
        return def;
    }

    if (spaceCount)
        return {spaces: true, count: spaceCount};

    if (tabCount)
        return {spaces: false};
}

export function createConnectProgramCommand(before: any) {
    const cmd = program.command('connect <warpName> [projectDir]')
        .description('Connect the Node.js project in [projectDir] to the warp <warpName>. The current directory is used if not specified.')
        .option("--no-login", "Fail when not logged in instead of prompting")
        .option("--no-update-build-script", "Don't update the package.json's build script. You'll need to run 'warp connect' manually each time the warp boots.")
        .option("--ci", "Both --no-login and --no-update-build-script, safe for Continuous Integration scripts.")
        .action(async function (warpName: string, projectDir: string, cmd: Command) {
            if (before)
                before();

            projectDir = projectDir || process.cwd();

            const opts = cmd.opts();

            let login = true;
            let updateBuild = true;

            if (!opts.ci) {
                login = opts.login;
                updateBuild = opts.updateBuild;
            }

            if (await executeConnectAsync(warpName, projectDir, updateBuild, login)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function executeConnectAsync(warpName: string, projectDir: string, updateBuild: boolean, login: boolean): Promise<boolean> {
    if (!await maybeExecuteLoginAsync(login)) {
        return false;
    }

    if (!fs.existsSync(projectDir)) {
        logLocalError("The project directory does not exist.");
        return false;
    }

    let packageJson = path.join(projectDir, "package.json");
    if (!fs.existsSync(projectDir)) {
        logLocalError("The project directory does not contain a package.json file.");
        return false;
    }

    if (!await validateWarpNameOrErrorAsync(warpName)) {
        return false;
    }

    //get the admin key file from the login
    let adminKeyFile = AdminKeyFile.tryOpen();
    if (!adminKeyFile) {
        return false;
    }
    let adminKey = adminKeyFile.adminKey;

    //get the warp index for the warp name
    const logContext = createLogContext();
    let response;
    try {
        response = await JayneSingleton.getWarpConnectionInfoAsync(logContext, adminKey, warpName);
    } catch (e) {
        // @ts-ignore
        logRemoteError(logContext, e.message);
        return false;
    }

    let userKey = response.userKey;
    let warpIndex = deserializeWarpIndex(response.warpIndexStr);

    let regenCommand;
    if (!updateBuild) {
        regenCommand = `warp connect ${warpName}`;
    } else {
        [, regenCommand] = getBuildKeyAndRegenerateCommand(warpName);
    }

    const {packageName, relRootPath, wasUpdate} = createClient(logContext, userKey, warpIndex, regenCommand, projectDir);

    updatePackageJson(packageJson, warpName, updateBuild, packageName, relRootPath);


    if(wasUpdate)
        logOk("Warp connection updated");
    else {
        logOk("Warp connection created");
        const usesYarn = fs.existsSync(path.join(projectDir, "yarn.lock"));
        logNotice(`${usesYarn ? "yarn install" : "npm install (or yarn install)"} must be run on this project before making use of the newly connected warp.`);
        console.log("");

        const importStatements = `${chalk.magentaBright("Import instructions:")}
${chalk.blueBright(" If you prefer ES6 import statements:")}
   import { warp } from "${CLIENT_LIB_NAME}";
   import { ${chalk.yellow("/* your warp types here... */")} } from "${chalk.greenBright(packageName)}";

${chalk.blueBright(" Or if you prefer using require:")}
   const { warp } = require("${CLIENT_LIB_NAME}");
   const { ${chalk.yellow("/* your warp types here... */")} } = require("${chalk.greenBright(packageName)}");`;

        console.log(importStatements);
        console.log("");
    }

    return true;
}
