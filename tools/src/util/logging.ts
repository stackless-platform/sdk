import chalk from "chalk";
import {GlobalOptions} from "./global-options.js";

export function getColor(colorFunc:(...text: unknown[]) => string, str: string) {
    return GlobalOptions.color ? colorFunc(str) : str;
}

export function logDetails(msg: string) {
    if (!GlobalOptions.quiet)
        console.log(getColor(chalk.gray, msg));
}

export function logLocalError(msg: string) {
    console.log(getColor(chalk.redBright, "Error: ") + msg);
    return msg;
}

export function logRemoteError(logContext: string, msg: string) {
    console.log(getColor(chalk.redBright, "Stackless Platform Error: ") + msg);
    console.error(getColor(chalk.gray, 'When reporting this error to the Stackless support Discord channel, give them this request id: ') + getColor(chalk.redBright, logContext));
    return msg;
}

export function logWarning(msg: string) {
    console.log(getColor(chalk.yellowBright, "Warning: ") + msg);
    return msg;
}

export function logNotice(msg: string) {
    console.log(getColor(chalk.yellow, "Notice: ") + msg);
    return msg;
}

export function logVerbose(msg: string) {
    if (!GlobalOptions.quiet && GlobalOptions.verbose)
        console.log(getColor(chalk.gray, "VERBOSE") + "   " + msg);
    return msg;
}

export function logOk(msg: string) {
    if (!GlobalOptions.quiet)
        console.log(getColor(chalk.greenBright, "OK: ") + msg);
    return msg;
}

export function logSuccess(msg: string) {
    if (!GlobalOptions.quiet)
        console.log(getColor(chalk.blueBright, "Success: ") + msg);
    return msg;
}