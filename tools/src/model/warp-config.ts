import {requiresTruthy} from "../util/requires";
import fs from "fs";
import path from "path";
import {BaseConfig} from "./base-config";
import {logLocalError} from "../util/logging";
import {warpNameValidatorAsync} from "../util/validators";
import {decodeBase64, encodeBase64} from "../util/base64";

export const WARP_CONFIG_FILE_NAME = "warp.json";

export class WarpClassMapping {
    constructor(public className: string, public classId: number) {
    }
}

export class WarpSrcClassTagMapping {
    constructor(public name: string, public tag: string) {
    }
}

export class IdentityClassMapping {
    constructor(public className: string, public classId: number, public tag: string) {
    }
}

export class WarpIdentity {
    constructor(public adminKey: string,
                public checksum?: number,
                public warpId?: string,
                public warpVersion?: string,
                public identityClassMappings?: IdentityClassMapping[],
                public lastClassId?: number) {
        requiresTruthy('adminKey', adminKey);
        if(checksum || warpId || warpVersion) {
            requiresTruthy('checksum', checksum);
            requiresTruthy('warpId', warpId);
            requiresTruthy('warpVersion', warpVersion);
            requiresTruthy('identityClassMappings', identityClassMappings);
            requiresTruthy('lastClassId', lastClassId);
        }
    }
}

export class WarpConfig extends BaseConfig {
    constructor(public warp: string,
                public classes: WarpSrcClassTagMapping[],
                public identity: WarpIdentity) {
        super();
        requiresTruthy('warp', warp);
        requiresTruthy('identity', identity);
    }

    public writeToDir(dir: string) : string {
        if (!fs.existsSync(dir))
            throw new Error(`${dir} does not exist`);
        let file = path.join(dir, WARP_CONFIG_FILE_NAME);

        let obj = {
            warp: this.warp,
            classes: this.classes,
            identity: encodeBase64(JSON.stringify(this.identity))
        }

        this.writeToFile(obj, file);

        return file;
    }

    public static fileExists(dir: string) {
        return fs.existsSync(path.join(dir, WARP_CONFIG_FILE_NAME));
    }

    public static delete(dir: string) {
        fs.unlinkSync(path.join(dir, WARP_CONFIG_FILE_NAME));
    }

    public static async tryOpen(dir: string): Promise<WarpConfig | undefined> {
        let file = path.join(dir, WARP_CONFIG_FILE_NAME);
        if (!fs.existsSync(file)) {
            logLocalError(`${WARP_CONFIG_FILE_NAME} does not exist in ${dir}`);
            return;
        }

        let json = fs.readFileSync(file, {encoding: "utf8", flag: 'r'});
        if (!json) {
            logLocalError(`Invalid or corrupt ${WARP_CONFIG_FILE_NAME}`);
            return;
        }

        let fileObj = JSON.parse(json);
        if (!fileObj ||
            !fileObj.hasOwnProperty("warp") ||
            !fileObj.hasOwnProperty("identity") ||
            !fileObj.hasOwnProperty('classes')) {
            logLocalError(`Invalid or corrupt ${WARP_CONFIG_FILE_NAME}`);
            return;
        }

        if (!fileObj.warp || !await warpNameValidatorAsync(fileObj.warp)) {
            logLocalError(`Invalid warp name in ${WARP_CONFIG_FILE_NAME}`);
            return;
        }

        if(!fileObj.identity) {
            logLocalError(`Invalid warp identity in ${WARP_CONFIG_FILE_NAME}`);
            return;
        }

        if(!fileObj.classes) {
            logLocalError(`Invalid warp class mappings in ${WARP_CONFIG_FILE_NAME}`);
            return;
        }

        return new WarpConfig(fileObj.warp, fileObj.classes, JSON.parse(decodeBase64(fileObj.identity)));
    }
}