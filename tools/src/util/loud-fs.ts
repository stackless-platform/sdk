import fs, {PathLike} from "fs";
import {logLocalError} from "./logging.js";

export function createDir(path: PathLike) {
    try {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, {recursive: true});
        }
    } catch (e) {
        throw new Error(logLocalError(`Unable to create directory ${path}: ${JSON.stringify(e)}`));
    }
}

export function recreateDir(path: PathLike) {
    rmDir(path);
    try {
        fs.mkdirSync(path, {recursive: true});
    } catch (e) {
        throw new Error(logLocalError(`Unable to recreate directory ${path}: ${JSON.stringify(e)}`));
    }
}

export function rmDir(path: PathLike) {
    try {
        if (fs.existsSync(path)) {
            fs.rmdirSync(path, {recursive: true});
        }
    } catch (e) {
        throw new Error(logLocalError(`Unable to remove ${path}: ${JSON.stringify(e)}`));
    }
}