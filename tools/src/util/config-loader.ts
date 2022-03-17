import fs from 'fs';
import path from "path";

function getNodeEnv() : string {
    let value = process.env.NODE_ENV || "development";
    if(!value)
        throw new Error("Node environment not set");
    return value.toLowerCase();
}

export function loadConfigFile() : any {
    let configFile = path.join(`config.${getNodeEnv()}.json`);
    if(!fs.existsSync(configFile)) {
        throw new Error(`Config file ${configFile} does not exist`);
    }
    let jsonStr = fs.readFileSync(configFile).toString();
    if(!jsonStr)
        throw new Error(`Config file ${configFile} was empty`);
    return JSON.parse(jsonStr);
}