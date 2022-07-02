import { requiresTruthy } from "../util/requires.js";
import fs from "fs";
import path from "path";
import { BaseConfig } from "./base-config.js";
import { logLocalError } from "../util/logging.js";
import { warpNameValidatorAsync } from "../util/validators.js";
import { decodeBase64, encodeBase64 } from "../util/base64.js";
import { WARP_CONFIG_FILE_NAME } from "../constants.js";

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
        if (checksum || warpId || warpVersion) {
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
        public types: WarpSrcClassTagMapping[],
        public identity: WarpIdentity,
        public onBootModule: string) {
        super();
        requiresTruthy('warp', warp);
        requiresTruthy('identity', identity);
        requiresTruthy('onBootModule', onBootModule);
    }

    public writeToDir(dir: string): string {
        if (!fs.existsSync(dir))
            throw new Error(`${dir} does not exist`);
        let file = path.join(dir, WARP_CONFIG_FILE_NAME);

        let obj = {
            warp: this.warp,
            types: this.types,
            identity: encodeBase64(JSON.stringify(this.identity)),
            onBootModule: this.onBootModule
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

    public static async open(dir: string): Promise<WarpConfig> {
        let file = path.join(dir, WARP_CONFIG_FILE_NAME);
        if (!fs.existsSync(file)) {
            throw new Error(logLocalError(`${WARP_CONFIG_FILE_NAME} does not exist in ${dir}`));
        }

        let json = fs.readFileSync(file, { encoding: "utf8", flag: 'r' });
        if (!json) {
            throw new Error(logLocalError(`Invalid or corrupt ${WARP_CONFIG_FILE_NAME}`));
        }

        let fileObj = JSON.parse(json);
        if (!fileObj ||
            !fileObj.hasOwnProperty("warp") ||
            !fileObj.hasOwnProperty("identity") ||
            !fileObj.hasOwnProperty('types') ||
            !fileObj.hasOwnProperty('onBootModule')) {
            throw new Error(logLocalError(`Invalid or corrupt ${WARP_CONFIG_FILE_NAME}`));
        }

        if (!fileObj.warp || !await warpNameValidatorAsync(fileObj.warp)) {
            throw new Error(logLocalError(`Invalid warp name in ${WARP_CONFIG_FILE_NAME}`));
        }

        if (!fileObj.identity) {
            throw new Error(logLocalError(`Invalid warp identity in ${WARP_CONFIG_FILE_NAME}`));
        }

        if (!fileObj.types) {
            throw new Error(logLocalError(`Invalid warp type mappings in ${WARP_CONFIG_FILE_NAME}`));
        }

        if(!fileObj.onBootModule) {
            throw new Error(logLocalError(`Invalid onBootModule value in ${WARP_CONFIG_FILE_NAME}`));
        }

        if(path.extname(fileObj.onBootModule)) {
            throw new Error(logLocalError(`onBootModule value must not have a file extension.`));
        }

        return new WarpConfig(fileObj.warp, fileObj.types, JSON.parse(decodeBase64(fileObj.identity)), fileObj.onBootModule);
    }
}