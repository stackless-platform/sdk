import {requiresTruthy} from "../util/requires";
import path from "path";
import fs, {PathLike} from "fs";
import {logLocalError} from "../util/logging";
import {homedir} from "os";
import {BaseConfig} from "./base-config";

export const ADMIN_KEY_LENGTH = 256;
export const ADMIN_KEY_FILE_MODE = 0o600; //just like ~/.ssh/id_rsa (etc)

export function getKeyFilePath() : string {
    const home_dir = homedir();
    return path.join(home_dir, '.config', 'stacklessjs', 'warp-admin-key.json');
}

export function isLoggedIn() : boolean {
    return fs.existsSync(getKeyFilePath());
}

export class AdminKeyFile extends BaseConfig {
    constructor(public adminKey: string) {
        super();
        requiresTruthy('adminKey', adminKey);
    }
    public write() {
        let file = getKeyFilePath();
        let dir = path.dirname(file);
        if(!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        this.writeToFile(this, file, ADMIN_KEY_FILE_MODE);
    }

    public static fromJsonObject(jsonObj: any) : AdminKeyFile {
        const baseError = "Unable to create KeyFile because ";
        if(!jsonObj) {
            throw new Error(logLocalError(`${baseError} the json object was empty`));
        }
        if(!jsonObj.hasOwnProperty('adminKey')) {
            throw new Error(logLocalError(`${baseError} the admin key was not present`));
        }
        if(!jsonObj.adminKey || jsonObj.adminKey.length !== ADMIN_KEY_LENGTH) {
            throw new Error(logLocalError(`${baseError} the admin key was invalid`));
        }
        return new AdminKeyFile(jsonObj.adminKey);
    }

    public static delete() {
        fs.unlinkSync(getKeyFilePath());
    }

    public static exists() {
        return fs.existsSync(getKeyFilePath());
    }

    public static tryOpen() : AdminKeyFile | undefined {
        const keyFilePath = getKeyFilePath();
        if(!fs.existsSync(keyFilePath)) {
            logLocalError("Not logged in");
            return;
        }
        return AdminKeyFile.tryFromKeyFile(keyFilePath);
    }

    public static tryFromKeyFile(file: PathLike) : AdminKeyFile | undefined {
        if (!fs.existsSync(file)) {
            logLocalError("Supplied key file does not exist")
            return;
        }

        let keyJson = fs.readFileSync(file, {encoding: 'utf8', flag: 'r'});
        if (!keyJson) {
            logLocalError("Invalid or corrupt key file");
            return;
        }

        let keyObj = JSON.parse(keyJson);
        if (!keyObj || !keyObj.hasOwnProperty("adminKey")) {
            logLocalError("Invalid or corrupt key file");
            return;
        }

        if(!keyObj.adminKey || keyObj.adminKey.length != ADMIN_KEY_LENGTH) {
            logLocalError("Invalid adminKey value in key file");
            return;
        }

        return new AdminKeyFile(keyObj.adminKey);
    }
}