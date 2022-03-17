import fs, {Mode} from "fs";

export class BaseConfig {
    constructor() {
    }
    protected writeToFile(what: any, file: string, mode?: Mode) {
        let json = JSON.stringify(what, null, 4);
        if(!mode) {
            fs.writeFileSync(file, json, {
                encoding: "utf8",
                flag: "w"
            });
        } else {
            fs.writeFileSync(file, json, {
                encoding: "utf8",
                flag: "w",
                mode: mode
            });
        }
    }
}